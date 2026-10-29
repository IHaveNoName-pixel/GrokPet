using System.Text.Json;
using System.Text.RegularExpressions;

internal static class HookEvent
{
    private static string Text(JsonElement d,string name,int max=160)=>d.ValueKind==JsonValueKind.Object&&d.TryGetProperty(name,out var v)&&v.ValueKind==JsonValueKind.String?(v.GetString()??"")[..Math.Min((v.GetString()??"").Length,max)]:"";
    private static string Phase(JsonElement d)
    {
        string name=Text(d,"tool_name").ToLowerInvariant();
        if(Regex.IsMatch(name,@"(^|[._])(?:apply_patch|edit|write|write_file|edit_file|replace_file_content)$"))return "writing";
        if(name.Contains("search")||name.Contains("web__run")||name=="web.run")return "searching";
        if((name=="bash"||name.EndsWith("exec_command"))&&d.TryGetProperty("tool_input",out var input))
        {
            string command=Text(input,"command",4096);if(command.Length==0)command=Text(input,"cmd",4096);
            if(Regex.IsMatch(command,@"(?:^|[;|\r\n&])\s*(?:rg|grep|findstr|Select-String|Get-ChildItem)(?:\s|$)",RegexOptions.IgnoreCase))return "searching";
        }
        return "working";
    }
    private static bool Failed(JsonElement value,int depth=0)
    {
        if(depth>4)return false;
        if(value.ValueKind==JsonValueKind.String)
        {
            string text=value.GetString()??"";
            try{using var parsed=JsonDocument.Parse(text);return Failed(parsed.RootElement,depth+1);}catch(JsonException){}
            return Regex.IsMatch(text,@"(?:Process exited with code|exit_code\s*[:=])\s*-?[1-9]\d*\b",RegexOptions.IgnoreCase);
        }
        if(value.ValueKind!=JsonValueKind.Object)return false;
        if(value.TryGetProperty("isError",out var error)&&error.ValueKind==JsonValueKind.True)return true;
        if(value.TryGetProperty("success",out var success)&&success.ValueKind==JsonValueKind.False)return true;
        foreach(string key in new[]{"exit_code","exitCode"})if(value.TryGetProperty(key,out var code)&&code.ValueKind==JsonValueKind.Number&&code.TryGetInt32(out int n)&&n!=0)return true;
        if(value.TryGetProperty("error",out var reason)&&reason.ValueKind is not (JsonValueKind.Null or JsonValueKind.False)&&reason.ToString().Length>0)return true;
        if(value.TryGetProperty("structuredContent",out var structured)&&Failed(structured,depth+1))return true;
        if(value.TryGetProperty("content",out var content)&&content.ValueKind==JsonValueKind.Array)
            foreach(var item in content.EnumerateArray())if(item.ValueKind==JsonValueKind.Object&&item.TryGetProperty("text",out var text)&&Failed(text,depth+1))return true;
        return false;
    }
    internal static object Normalize(JsonElement d,string eventName)=>new {
        kind="codex",@event=eventName,session=Text(d,"session_id"),turn=Text(d,"turn_id"),message=Text(d,"last_assistant_message",240),
        toolId=Text(d,"tool_use_id"),phase=eventName=="PreToolUse"?Phase(d):"",failed=eventName=="PostToolUse"&&d.TryGetProperty("tool_response",out var response)&&Failed(response)
    };
}
