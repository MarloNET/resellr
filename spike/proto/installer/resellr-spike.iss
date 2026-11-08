; resellr-spike installer (Inno Setup 6), throwaway prototype for the Windows spike.
; Build: ISCC.exe /DStageDir=<stage> /DOutDir=<out> resellr-spike.iss

#ifndef StageDir
  #error StageDir must be defined (/DStageDir=...)
#endif
#ifndef OutDir
  #define OutDir "Output"
#endif

[Setup]
AppId=resellr-spike
AppName=resellr-spike
AppVersion=0.0.0-spike
AppPublisher=MarloNET (spike)
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\resellr-spike
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
UsePreviousAppDir=no
OutputDir={#OutDir}
OutputBaseFilename=resellr-spike-setup
Compression=lzma2/fast
SolidCompression=no
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
Uninstallable=yes
CreateUninstallRegKey=yes

[Files]
Source: "{#StageDir}\resellr-node.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "resellr-spike"; ValueData: """{app}\resellr-node.exe"" ""{app}\app\launcher.mjs"" supervise"; Flags: uninsdeletevalue

[Icons]
Name: "{userprograms}\resellr-spike"; Filename: "{app}\resellr-node.exe"; Parameters: """{app}\app\launcher.mjs"" open"; WorkingDir: "{app}"
Name: "{userprograms}\resellr-spike beenden"; Filename: "{app}\resellr-node.exe"; Parameters: """{app}\app\launcher.mjs"" stop"; WorkingDir: "{app}"
Name: "{userdesktop}\resellr-spike"; Filename: "{app}\resellr-node.exe"; Parameters: """{app}\app\launcher.mjs"" open"; WorkingDir: "{app}"
