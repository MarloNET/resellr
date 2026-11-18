; Installer script (CU-273, ADR-008, Technical Specification 2.19 "Installationspaket"): Inno Setup 6
; package that installs resellr for the current user without admin rights into
; %LOCALAPPDATA%\Programs\resellr, with the autostart entry under HKCU, the shortcuts "resellr" and
; "resellr beenden", and `open` after the installation. The uninstaller removes the program
; folder (with `launcher-state.js` and its lock file), the autostart entry and the shortcuts; data
; folder, logs and update copies under %LOCALAPPDATA%\resellr stay. Update and uninstallation first
; end resellr with `stop --for-update` and change nothing if that fails (#131, Nachtrag MAR-471).
;
; Build: iscc /DAppVersion=<version> [/DStageDir=<program folder>] [/O<output folder>] resellr.iss
; The staged program folder holds resellr-node.exe (CU-274), node.exe (CU-275), app\ (CU-276)
; and the other files of the program folder (2.19); it is packaged as it is.
; Betriebshandbuch.pdf (CU-316, Nachtrag MAR-599) has its own entry, so iscc fails without it.

#ifndef AppVersion
  #error AppVersion is not defined; call iscc with /DAppVersion=<version>
#endif
#ifndef StageDir
  #define StageDir "..\..\..\build\package"
#endif

#define Runtime "{app}\resellr-node.exe"
#define Launcher "{app}\app\launcher.mjs"

[Setup]
; Fixed for every version, so a newer package replaces the installed one.
AppId={{8C3935BA-53F2-4B5B-B8FE-5D400324264C}
AppName=resellr
AppVersion={#AppVersion}
AppPublisher=MarloNET
; No admin rights and no consent dialog: install for the current user only (ADR-008 A).
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\resellr
DisableDirPage=yes
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\..\..\build\installer
OutputBaseFilename=resellr-setup-{#AppVersion}
UninstallDisplayName=resellr
UninstallDisplayIcon={#Runtime}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ShowLanguageDialog=no

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Files]
Source: "{#StageDir}\*"; Excludes: "\Betriebshandbuch.pdf"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\Betriebshandbuch.pdf"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
; Starts the supervisor at sign-in (S-1); removed with the uninstallation.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "resellr"; ValueData: """{#Runtime}"" ""{#Launcher}"" supervise"; Flags: uninsdeletevalue

[Icons]
Name: "{userprograms}\resellr"; Filename: "{#Runtime}"; Parameters: """{#Launcher}"" open"; WorkingDir: "{app}"
Name: "{userdesktop}\resellr"; Filename: "{#Runtime}"; Parameters: """{#Launcher}"" open"; WorkingDir: "{app}"
Name: "{userprograms}\resellr beenden"; Filename: "{#Runtime}"; Parameters: """{#Launcher}"" stop"; WorkingDir: "{app}"

[Run]
; Without "postinstall": runs after every installation, also a silent one.
Filename: "{#Runtime}"; Parameters: """{#Launcher}"" open"; WorkingDir: "{app}"; Flags: nowait

[UninstallDelete]
; Written by the launcher at run time (2.18), so the uninstaller does not know them otherwise. The
; lock file is left behind only by an interrupted write.
Type: files; Name: "{app}\launcher-pages\launcher-state.js"
Type: files; Name: "{app}\launcher-pages\launcher-state.js.lock"

[Code]
// Stopping before an update and before the uninstallation (2.18 `stop --for-update`, 2.19
// "Installationspaket", Nachtrag MAR-471): the same call and evaluation for both.

// The umlaut as a character code, since iscc reads a script without BOM in the ANSI code page.
function StopFailedMessage(): String;
begin
  Result := 'resellr konnte nicht beendet werden. Bitte sp' + #$00E4 + 'ter erneut versuchen.';
end;

// Runs `stop --for-update` of the installed resellr and waits for its end. True: go on (exit code
// 0, or the call cannot be started, e.g. because resellr-node.exe is missing, so no resellr runs
// from the program folder); False: stopping failed, change nothing.
function StopResellr(): Boolean;
var
  ResultCode: Integer;
begin
  if not Exec(ExpandConstant('{#Runtime}'), '"' + ExpandConstant('{#Launcher}') + '" stop --for-update',
    ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := True;
    exit;
  end;
  Result := ResultCode = 0;
end;

// Update: before Setup replaces files; a non-empty result stops Setup without any change.
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  if StopResellr() then
    Result := ''
  else
    Result := StopFailedMessage();
end;

// Uninstallation: after the question whether to remove resellr and before the first file and the
// autostart entry are removed.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usAppMutexCheck) and not StopResellr() then
  begin
    SuppressibleMsgBox(StopFailedMessage(), mbError, MB_OK, IDOK);
    Abort;
  end;
end;
