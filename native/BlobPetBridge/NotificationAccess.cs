using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Windows.UI.Notifications;
using Windows.UI.Notifications.Management;

internal static class NotificationAccess
{
    internal static void Status() => Program.Emit(new { kind = "permission", status = UserNotificationListener.Current.GetAccessStatus().ToString() });
    internal static void Run()
    {
        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        var status = new TextBlock { Text = "仅在你允许后，将新到的 Windows 通知显示为桌宠气泡。消息仅在本机转发，不上传、不保存历史。", TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 18) };
        var button = new Button { Content = "请求 Windows 通知访问权限", Padding = new Thickness(12, 8, 12, 8) };
        var panel = new StackPanel { Margin = new Thickness(24) }; panel.Children.Add(status); panel.Children.Add(button);
        var window = new Window { Title = "桌宠 · Windows 通知授权", Width = 480, Height = 240, ResizeMode = ResizeMode.NoResize, Content = panel, WindowStartupLocation = WindowStartupLocation.CenterScreen };
        var listener = UserNotificationListener.Current;
        var known = new HashSet<string>();
        bool first = true, reading = false;
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        async Task Poll()
        {
            if (reading) return;
            reading = true;
            try
            {
                if (listener.GetAccessStatus() != UserNotificationListenerAccessStatus.Allowed)
                { timer.Stop(); Status(); app.Shutdown(); return; }
                var notifications = await listener.GetNotificationsAsync(NotificationKinds.Toast);
                var current = new HashSet<string>();
                foreach (var n in notifications)
                {
                    try
                    {
                        string id = n.Id + ":" + n.CreationTime.UtcTicks;
                        current.Add(id);
                        if (!first && !known.Contains(id))
                        {
                            var elements = n.Notification.Visual.GetBinding(KnownNotificationBindings.ToastGeneric)?.GetTextElements();
                            if (elements is not null && elements.Count > 0)
                                Program.Emit(new { kind = "notification", id, source = n.AppInfo.DisplayInfo.DisplayName, title = elements[0].Text,
                                    body = string.Join(" ", elements.Skip(1).Select(e => e.Text)) });
                        }
                    }
                    catch { /* A toast without supported text must not stop others. */ }
                }
                known = current; first = false;
            }
            catch (Exception e) { Program.Emit(new { kind = "error", message = "通知读取失败", code = e.HResult }); }
            finally { reading = false; }
        }
        async Task Start() { window.Hide(); Program.Emit(new { kind = "permission", status = "Allowed" }); await Poll(); timer.Start(); }
        timer.Tick += async (_, _) => await Poll();
        button.Click += async (_, _) =>
        {
            button.IsEnabled = false;
            try
            {
                var access = await listener.RequestAccessAsync();
                Program.Emit(new { kind = "permission", status = access.ToString() });
                if (access == UserNotificationListenerAccessStatus.Allowed) await Start();
                else status.Text = "Windows 未授予访问权限。可在 Windows 设置 > 隐私和安全性 > 通知中检查，之后重新点击授权。";
            }
            catch (Exception e) { status.Text = $"系统拒绝访问（0x{e.HResult:X8}）。请检查 Windows 通知隐私权限；部分系统需要带应用标识的安装包。"; Program.Emit(new { kind = "permission", status = "Unavailable" }); }
            finally { button.IsEnabled = true; }
        };
        window.Closed += (_, _) => app.Shutdown();
        app.Startup += async (_, _) =>
        {
            if (listener.GetAccessStatus() == UserNotificationListenerAccessStatus.Allowed) await Start();
            else { window.Show(); Status(); }
        };
        app.Run();
    }
}
