param([ValidateSet('transcribe','speak')][string]$Operation)
$ErrorActionPreference='Stop'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$engine=$null;$stream=$null
try {
  Add-Type -AssemblyName System.Speech
  $request=[Console]::In.ReadToEnd() | ConvertFrom-Json
  if($Operation -eq 'transcribe') {
    $installed=@([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
    $recognizer=$installed | Where-Object {$_.Culture.Name -eq 'zh-CN'} | Select-Object -First 1
    if(-not $recognizer){$recognizer=$installed | Select-Object -First 1}
    if(-not $recognizer){throw 'No offline speech recognizer installed'}
    $engine=New-Object System.Speech.Recognition.SpeechRecognitionEngine($recognizer)
    $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    if($recognizer.Culture.Name -eq 'zh-CN') {
      $commands=New-Object System.Speech.Recognition.Choices
      $commands.Add([string[]]@('十分钟后提醒我喝水','一分钟后提醒我喝水','开始专注二十五分钟','暂停音乐','播放音乐','上一首','下一首','查询系统状态','暂停专注','继续专注','停止专注'))
      $builder=New-Object System.Speech.Recognition.GrammarBuilder
      $builder.Culture=$recognizer.Culture
      $builder.Append($commands)
      $engine.LoadGrammar((New-Object System.Speech.Recognition.Grammar($builder)))
    }
    $bytes=[Convert]::FromBase64String([string]$request.audio)
    $stream=New-Object System.IO.MemoryStream(,$bytes)
    $engine.SetInputToWaveStream($stream)
    $parts=New-Object 'System.Collections.Generic.List[string]'
    for($i=0;$i -lt 64;$i++){
      try { $recognized=$engine.Recognize([TimeSpan]::FromSeconds(10)) } catch { if($i -gt 0){break};throw }
      if(-not $recognized){break}
      if($recognized.Confidence -ge 0.25){$parts.Add($recognized.Text)}
    }
    @{ok=$true;text=($parts -join ' ');culture=$recognizer.Culture.Name} | ConvertTo-Json -Compress
  } else {
    $engine=New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voice=$engine.GetInstalledVoices() | Where-Object {$_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'zh-CN'} | Select-Object -First 1
    if($voice){$engine.SelectVoice($voice.VoiceInfo.Name)}
    $stream=New-Object System.IO.MemoryStream
    $engine.SetOutputToWaveStream($stream)
    $engine.Speak([string]$request.text)
    $engine.SetOutputToNull()
    @{ok=$true;audio=[Convert]::ToBase64String($stream.ToArray())} | ConvertTo-Json -Compress
  }
} catch {
  @{ok=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress
  exit 1
} finally {
  if($engine){$engine.Dispose()}
  if($stream){$stream.Dispose()}
}
