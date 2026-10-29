using System.Diagnostics;
using Windows.Media.Control;

internal sealed class MediaMonitor
{
    private GlobalSystemMediaTransportControlsSessionManager? manager;
    private GlobalSystemMediaTransportControlsSession? session;
    private volatile bool dirty = true;
    private string title = "", artist = "", album = "";
    private static bool NetEase(string id) => id.Contains("cloudmusic", StringComparison.OrdinalIgnoreCase) || id.Contains("网易云音乐", StringComparison.Ordinal);
    internal static async Task Control(string action)
    {
        if(action is not ("previous" or "toggle" or "next")){Program.Emit(new {ok=false,reason="无效的音乐操作"});return;}
        var manager=await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        var sessions=manager.GetSessions().Where(s=>NetEase(s.SourceAppUserModelId)).ToArray();
        var selected=sessions.FirstOrDefault(s=>s.GetPlaybackInfo().PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)??sessions.FirstOrDefault();
        if(selected is null){Program.Emit(new {ok=false,reason="未找到网易云媒体会话，请先打开网易云并选择歌曲"});return;}
        bool ok=action switch {
            "previous"=>await selected.TrySkipPreviousAsync(),
            "next"=>await selected.TrySkipNextAsync(),
            _=>selected.GetPlaybackInfo().PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing
                ?await selected.TryPauseAsync():await selected.TryPlayAsync()
        };
        Program.Emit(new {ok,reason=ok?"":"网易云未允许此操作，请在播放器中重试"});
    }
    private void Changed(GlobalSystemMediaTransportControlsSession sender, MediaPropertiesChangedEventArgs args) => dirty = true;
    private void Detach()
    {
        if(session is not null) { try { session.MediaPropertiesChanged -= Changed; } catch { } }
        session = null; title = artist = album = ""; dirty = true;
    }
    private async Task<object> Read()
    {
        manager ??= await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        var candidates = manager.GetSessions().Where(s => NetEase(s.SourceAppUserModelId)).ToArray();
        var selected = candidates.FirstOrDefault(s => s.GetPlaybackInfo().PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing) ?? candidates.FirstOrDefault();
        if(selected is null)
        {
            Detach();
            var processes=Process.GetProcessesByName("cloudmusic");bool running=processes.Length>0;foreach(var process in processes)process.Dispose();
            return new {kind="media",status=running?"unavailable":"none",reason=running?"网易云未发布系统媒体会话":"网易云未运行",observedAt=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()};
        }
        if(session is null || !ReferenceEquals(session,selected))
        { Detach(); session = selected; session.MediaPropertiesChanged += Changed; }
        if(dirty)
        {
            dirty = false;
            var props = await session.TryGetMediaPropertiesAsync();
            title = props.Title ?? ""; artist = props.Artist ?? ""; album = props.AlbumTitle ?? "";
        }
        var info = session.GetPlaybackInfo();
        var timeline = session.GetTimelineProperties();
        double rate = info.PlaybackRate ?? 1.0;
        double duration = Math.Max(0,(timeline.EndTime-timeline.StartTime).TotalMilliseconds);
        double? position = duration > 0 ? Math.Max(0,(timeline.Position-timeline.StartTime).TotalMilliseconds) : null;
        return new {kind="media",status="ready",source=session.SourceAppUserModelId,title,artist,album,
            state=info.PlaybackStatus.ToString().ToLowerInvariant(),positionMs=position,durationMs=duration,
            rate=double.IsFinite(rate)&&rate>0?rate:1.0,updatedAt=timeline.LastUpdatedTime.ToUnixTimeMilliseconds(),observedAt=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()};
    }
    internal static async Task Run(bool once=false)
    {
        var monitor = new MediaMonitor();
        do {
            try {Program.Emit(await monitor.Read());}
            catch(Exception e) {monitor.Detach();monitor.manager=null;Program.Emit(new {kind="media",status="error",reason="Windows 媒体信息暂不可用",code=e.HResult,observedAt=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()});}
            if(!once)await Task.Delay(1000);
        } while(!once);
        monitor.Detach();
    }
}
