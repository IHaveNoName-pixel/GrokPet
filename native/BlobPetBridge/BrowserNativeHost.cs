using System.IO;
using System.IO.Pipes;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

internal static class BrowserNativeHost
{
    private const string Origin = "chrome-extension://jbnhdhkajoldbipehgdakcblkonojfap/";
    internal static void Run(string[] args)
    {
        if (args.Length == 0 || !string.Equals(args[0], Origin, StringComparison.Ordinal)) return;
        var root = Directory.GetParent(AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar))?.FullName ?? "";
        var channel = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(root.ToLowerInvariant()))).ToLowerInvariant()[..12];
        var pipeName = "BlobPetStudy-" + WindowsIdentity.GetCurrent().User!.Value + "-" + channel;
        using var input = Console.OpenStandardInput(); using var output = Console.OpenStandardOutput();
        while (true)
        {
            var header = new byte[4]; if (!ReadExact(input,header)) break;
            int n = BitConverter.ToInt32(header); if (n <= 0 || n > 4096) break;
            var payload = new byte[n]; if (!ReadExact(input,payload)) break;
            bool delivered=false;
            try
            {
                using var doc=JsonDocument.Parse(payload);var d=doc.RootElement;
                string source=d.GetProperty("source").GetString()??"",id=d.GetProperty("id").GetString()??"",state=d.GetProperty("state").GetString()??"";
                if ((source!="edge"&&source!="chrome") || !Regex.IsMatch(id,"^[0-9]{1,20}$") || (state!="active"&&state!="paused"&&state!="complete"&&state!="interrupted")) throw new ArgumentException();
                string name=d.TryGetProperty("name",out var nm)?nm.GetString()??"":"";
                name=Path.GetFileName(name.Replace('\\','/'));if(name.Length>120)name=name[..120];
                double? received=d.TryGetProperty("received",out var rec)&&rec.ValueKind==JsonValueKind.Number?rec.GetDouble():null;
                double? total=d.TryGetProperty("total",out var tot)&&tot.ValueKind==JsonValueKind.Number?tot.GetDouble():null;
                if(received<0||total< -1||total>0&&received>total)throw new ArgumentException();
                var msg=JsonSerializer.Serialize(new {kind="transfer",source,id,state,name,received,total},Program.Json);
                using var pipe=new NamedPipeClientStream(".",pipeName,PipeDirection.Out,PipeOptions.Asynchronous);pipe.Connect(500);
                using var writer=new StreamWriter(pipe,new UTF8Encoding(false));writer.WriteLine(msg);writer.Flush();delivered=true;
            }
            catch { }
            var response=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new {ok=delivered},Program.Json));
            output.Write(BitConverter.GetBytes(response.Length));output.Write(response);output.Flush();
        }
    }
    private static bool ReadExact(Stream stream, byte[] buffer){int i=0;while(i<buffer.Length){int n=stream.Read(buffer,i,buffer.Length-i);if(n==0)return false;i+=n;}return true;}
}
