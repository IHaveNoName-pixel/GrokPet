using System.IO;
using System.IO.Pipes;
using System.Net.NetworkInformation;
using System.Security.Principal;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Diagnostics;
using System.Text;
using Microsoft.Win32;

internal static class Program
{
    internal static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private static readonly object OutputLock = new();
    private static Hardware? hardware;
    internal static void Emit(object value) { lock (OutputLock) { Console.WriteLine(JsonSerializer.Serialize(value, Json)); Console.Out.Flush(); } }
    private static string channel = "main";
    private static string PipeName => "BlobPetStudy-" + WindowsIdentity.GetCurrent().User!.Value + "-" + channel;
    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            if (!string.IsNullOrEmpty(Arg(args, "--channel"))) channel = Arg(args, "--channel");
            if (!Regex.IsMatch(channel, "^[a-zA-Z0-9]{1,32}$")) throw new ArgumentException("Invalid pipe channel");
            if (int.TryParse(Arg(args, "--parent"), out int parent))
                _ = Task.Run(async () => { try { await Process.GetProcessById(parent).WaitForExitAsync(); } catch { } Environment.Exit(0); });
            if (args.Contains("hook")) { Relay(args); return; }
            if (args.Contains("--metrics"))
            {
                _ = Task.Run(Listen);
                while (true) { Metrics(); Thread.Sleep(2000); }
            }
            if (args.Contains("--notification-status")) { NotificationAccess.Status(); return; }
            if (args.Contains("--notifications")) { NotificationAccess.Run(); return; }
        }
        catch (Exception e) { Emit(new { kind = "error", message = e.GetType().Name, code = e.HResult }); Environment.ExitCode = 1; }
    }
    private static async Task Listen()
    {
        while (true)
        {
            try
            {
                // Windows enforces a same-user ACL; no token or authentication file is used.
                using var pipe = new NamedPipeServerStream(PipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
                Emit(new {kind="bridge", status="ready"});
                await pipe.WaitForConnectionAsync();
                using var reader = new StreamReader(pipe);
                var raw = await reader.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(1));
                if (raw is not null && raw.Length < 4096)
                {
                    using var parsed = JsonDocument.Parse(raw);
                    Emit(parsed.RootElement);
                }
            }
            catch { Emit(new {kind="bridge", status="busy"}); await Task.Delay(5000); }
        }
    }
    private static void Metrics()
    {
        var adapters = NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == OperationalStatus.Up).Select(n =>
        {
            var s = n.GetIPStatistics();
            bool tunnel = Regex.IsMatch(n.Name + " " + n.Description, "vpn|tunnel|tun\\b|tap|sangfor|atrust|wireguard|clash", RegexOptions.IgnoreCase);
            bool physical = !tunnel && (n.NetworkInterfaceType == NetworkInterfaceType.Ethernet || n.NetworkInterfaceType == NetworkInterfaceType.Wireless80211)
                && !Regex.IsMatch(n.Name + " " + n.Description, "virtual|hyper-v|vethernet|vmware|loopback|bluetooth|filter|miniport|scheduler", RegexOptions.IgnoreCase);
            return new { id = n.Id, name = n.Name, description = n.Description, rx = s.BytesReceived, tx = s.BytesSent, physical, tunnel };
        }).ToArray();
        using var proxy = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Internet Settings");
        hardware ??= new Hardware();
        Emit(new { kind = "metrics", at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), adapters, hardware = hardware.Sample(),
            proxyEnabled = Convert.ToInt32(proxy?.GetValue("ProxyEnable", 0) ?? 0) != 0,
            pacConfigured = !string.IsNullOrWhiteSpace(proxy?.GetValue("AutoConfigURL") as string),
            tunnels = adapters.Where(a => a.tunnel).Select(a => a.name).ToArray() });
    }
    private static string Arg(string[] args, string key)
    { int i = Array.IndexOf(args, key); return i >= 0 && i + 1 < args.Length ? args[i + 1] : ""; }
    private static void Relay(string[] args)
    {
        try
        {
            using var input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false, true));
            string raw = input.ReadToEnd();
            if (raw.Length <= 1024 * 1024)
            {
                using var data = JsonDocument.Parse(raw);
                var d = data.RootElement;
                string Value(string name) => d.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() ?? "" : "";
                string text = Value("last_assistant_message");
                var payload = new { kind = "codex", @event = Arg(args, "--event"), session = Value("session_id"), turn = Value("turn_id"), message = text[..Math.Min(text.Length, 240)] };
                using var pipe = new NamedPipeClientStream(".", PipeName, PipeDirection.Out, PipeOptions.Asynchronous);
                pipe.Connect(250);
                using var writer = new StreamWriter(pipe); writer.WriteLine(JsonSerializer.Serialize(payload, Json));
            }
        }
        catch (Exception error) { if (args.Contains("--diagnostic")) Console.Error.WriteLine(error.GetType().Name + ": " + error.Message); }
        // Stop accepts an empty JSON result. Never approve, deny, block or add instructions.
        Console.WriteLine("{}");
    }
}
