; Subtitle Sync Studio - Inno Setup Script
; Generates a professional, standard Windows offline installer (SubtitleSync-Setup.exe)

#define MyAppName "Subtitle Sync Studio"
#define MyAppVersion "1.1.0"
#define MyAppPublisher "DH-0216"
#define MyAppURL "https://github.com/DH-0216/Subtitle-Sync"
#define MyAppExeName "SubtitleSync.exe"

[Setup]
AppId={{E5D9183B-764D-4E10-9118-E7BE9C4524BA}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\Subtitle Sync
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=dist
OutputBaseFilename=SubtitleSync-Setup
SetupIconFile=app_icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "installffmpeg"; Description: "Install FFmpeg globally (Recommended — required for subtitle synchronization)"; GroupDescription: "FFmpeg Audio Engine:"; Check: ShouldOfferFFmpeg

[Files]
; Main application executable and icon
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "app_icon.ico"; DestDir: "{app}"; Flags: ignoreversion

; Standalone FFmpeg executable for offline installation
Source: "bin\ffmpeg.exe"; DestDir: "{autopf}\FFmpeg\bin"; Flags: ignoreversion; Tasks: installffmpeg

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app_icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app_icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
const
  EnvironmentKey = 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment';

function IsFFmpegInstalled(): Boolean;
var
  PathEnv: string;
begin
  Result := False;

  // 1. Check common installation directories
  if FileExists(ExpandConstant('{autopf}\FFmpeg\bin\ffmpeg.exe')) or
     FileExists('C:\ffmpeg\bin\ffmpeg.exe') or
     FileExists(ExpandConstant('{localappdata}\Microsoft\WinGet\Links\ffmpeg.exe')) then
  begin
    Result := True;
    Exit;
  end;

  // 2. Check System PATH registry
  if RegQueryStringValue(HKLM, EnvironmentKey, 'Path', PathEnv) then
  begin
    if Pos('ffmpeg', Lowercase(PathEnv)) > 0 then
    begin
      Result := True;
      Exit;
    end;
  end;

  // 3. Check User PATH registry
  if RegQueryStringValue(HKCU, 'Environment', 'Path', PathEnv) then
  begin
    if Pos('ffmpeg', Lowercase(PathEnv)) > 0 then
    begin
      Result := True;
      Exit;
    end;
  end;
end;

function ShouldOfferFFmpeg(): Boolean;
begin
  // Only offer FFmpeg task if it is not already installed on the computer
  Result := not IsFFmpegInstalled();
end;

procedure AddToSystemPath(DirToAdd: string);
var
  CurrentPath: string;
begin
  if RegQueryStringValue(HKLM, EnvironmentKey, 'Path', CurrentPath) then
  begin
    if Pos(Lowercase(DirToAdd), Lowercase(CurrentPath)) = 0 then
    begin
      CurrentPath := CurrentPath + ';' + DirToAdd;
      RegWriteStringValue(HKLM, EnvironmentKey, 'Path', CurrentPath);
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if WizardIsTaskSelected('installffmpeg') then
    begin
      AddToSystemPath(ExpandConstant('{autopf}\FFmpeg\bin'));
    end;
  end;
end;
