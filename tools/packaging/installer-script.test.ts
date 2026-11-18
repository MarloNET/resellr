// Static check of the Inno Setup script (CU-273). The installation itself is checked on Windows
// by the Windows CI (CU-278, #146); until then this test pins the entries DER-105-01 and
// DER-105-04 depend on.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const SCRIPT = readFileSync(new URL('./installer/resellr.iss', import.meta.url), 'utf8');

/** Preprocessor `#define <name> "<value>"` of the script. */
function defines(script: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of script.matchAll(/^\s*#define\s+(\w+)\s+"([^"]*)"\s*$/gm)) {
    result.set(match[1] ?? '', match[2] ?? '');
  }
  return result;
}

/** Lines of one section without comments and preprocessor lines, `{#Name}` expanded. */
function section(name: string): string[] {
  const values = defines(SCRIPT);
  const lines: string[] = [];
  let inside = false;
  for (const raw of SCRIPT.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\[.+\]$/.test(line)) {
      inside = line === `[${name}]`;
      continue;
    }
    if (!inside || line === '' || line.startsWith(';') || line.startsWith('#')) continue;
    lines.push(line.replace(/\{#(\w+)\}/g, (_match, key: string) => values.get(key) ?? _match));
  }
  return lines;
}

/** `Name: "a ""b"""; Flags: x` → { Name: 'a "b"', Flags: 'x' } as Inno Setup reads it. */
function entry(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /\s*(\w+):\s*("(?:[^"]|"")*"|[^;]*)\s*(?:;|$)/gy;
  for (let match = pattern.exec(line); match?.[0]; match = pattern.exec(line)) {
    const value = (match[2] ?? '').trim();
    result[match[1] ?? ''] = value.startsWith('"')
      ? value.slice(1, -1).replaceAll('""', '"')
      : value;
  }
  return result;
}

function setup(): Record<string, string> {
  return Object.fromEntries(
    section('Setup').map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
  );
}

const RUNTIME = '{app}\\resellr-node.exe';
const LAUNCHER = '"{app}\\app\\launcher.mjs"';

describe('installer script resellr.iss (CU-273)', () => {
  it('DER-105-01 installs without admin rights into %LOCALAPPDATA%\\Programs\\resellr', () => {
    const directives = setup();

    expect(directives.PrivilegesRequired).toBe('lowest');
    // Allowing an override would offer an installation for all users with a consent dialog.
    expect(directives.PrivilegesRequiredOverridesAllowed).toBeUndefined();
    expect(directives.DefaultDirName).toBe('{localappdata}\\Programs\\resellr');
    expect(directives.DisableDirPage).toBe('yes');
    expect(directives.OutputBaseFilename).toBe('resellr-setup-{#AppVersion}');
  });

  it('DER-105-01 writes the autostart entry under HKCU character for character, with supervise', () => {
    expect(section('Registry').map(entry)).toEqual([
      {
        Root: 'HKCU',
        Subkey: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        ValueType: 'string',
        ValueName: 'resellr',
        ValueData: `"${RUNTIME}" ${LAUNCHER} supervise`,
        Flags: 'uninsdeletevalue',
      },
    ]);
  });

  it('DER-105-01 creates "resellr" (start menu and desktop, open) and "resellr beenden" (start menu, stop)', () => {
    const icons = section('Icons').map(entry);

    expect(icons.map(({ Name, Filename, Parameters }) => ({ Name, Filename, Parameters }))).toEqual(
      [
        { Name: '{userprograms}\\resellr', Filename: RUNTIME, Parameters: `${LAUNCHER} open` },
        { Name: '{userdesktop}\\resellr', Filename: RUNTIME, Parameters: `${LAUNCHER} open` },
        {
          Name: '{userprograms}\\resellr beenden',
          Filename: RUNTIME,
          Parameters: `${LAUNCHER} stop`,
        },
      ],
    );
  });

  it('DER-105-01 starts open after the installation, also when installed silently', () => {
    const run = section('Run').map(entry);

    expect(run).toEqual([
      expect.objectContaining({ Filename: RUNTIME, Parameters: `${LAUNCHER} open` }),
    ]);
    expect(run[0]?.Flags).not.toMatch(/postinstall|skipifsilent/);
  });

  it('DER-105-01 writes nothing under HKLM and uses no all-users folder', () => {
    expect(SCRIPT).not.toMatch(/\bHK(LM|A|CR|U32|U64)\b|HKEY_LOCAL_MACHINE/);
    expect(SCRIPT).not.toMatch(/\{(common|auto)\w*\}|\{pf\d*\}|\{sys\w*\}|\{win\}/);
  });

  it('DER-105-02 starts everything through resellr-node.exe, never through node.exe', () => {
    const programs = [...section('Icons'), ...section('Run')].map((line) => entry(line).Filename);

    expect(programs.every((program) => program === RUNTIME)).toBe(true);
    expect(entry(section('Registry')[0] ?? '').ValueData).toMatch(/^"\{app\}\\resellr-node\.exe" /);
  });

  it('DER-105-04 removes launcher-state.js with its lock file and leaves the folders under %LOCALAPPDATA%\\resellr alone', () => {
    expect(section('UninstallDelete').map(entry)).toEqual([
      { Type: 'files', Name: '{app}\\launcher-pages\\launcher-state.js' },
      { Type: 'files', Name: '{app}\\launcher-pages\\launcher-state.js.lock' },
    ]);
    // Data folder, logs and update copies lie outside {app} and are never named.
    expect(SCRIPT).not.toMatch(/\{localappdata\}\\resellr|Daten|Protokolle|Update-Kopien/);
    expect(section('UninstallRun')).toEqual([]);
  });

  it('packages the staged program folder as it is', () => {
    expect(section('Files').map(entry)[0]).toEqual({
      Source: '..\\..\\..\\build\\package\\*',
      Excludes: '\\Betriebshandbuch.pdf',
      DestDir: '{app}',
      Flags: 'ignoreversion recursesubdirs createallsubdirs',
    });
  });

  it('requires Betriebshandbuch.pdf (CU-316) in its own entry, so the build fails without it (Nachtrag MAR-599)', () => {
    const files = section('Files').map(entry);

    expect(files.slice(1)).toEqual([
      {
        Source: '..\\..\\..\\build\\package\\Betriebshandbuch.pdf',
        DestDir: '{app}',
        Flags: 'ignoreversion',
      },
    ]);
    expect(SCRIPT).not.toMatch(/skipifsourcedoesntexist/i);
  });

  describe('stopping before the update and the uninstallation (2.18 stop --for-update, Nachtrag MAR-471)', () => {
    const code = section('Code').join('\n');

    /** Pascal function or procedure `name`, from its header up to the next routine. */
    function routine(name: string): string {
      const match = new RegExp(
        `^(?:function|procedure) ${name}\\b[\\s\\S]*?(?=^(?:function|procedure|//) |(?![\\s\\S]))`,
        'm',
      ).exec(code);
      return match?.[0] ?? '';
    }

    it('calls stop --for-update of the installed resellr through resellr-node.exe and waits for its end', () => {
      const stop = routine('StopResellr');

      expect(stop).toContain(
        "Exec(ExpandConstant('{app}\\resellr-node.exe'), '\"' + ExpandConstant('{app}\\app\\launcher.mjs') + '\" stop --for-update',",
      );
      expect(stop).toContain('ewWaitUntilTerminated');
    });

    it('goes on with exit code 0 or when the call cannot be started, and stops on any other exit code', () => {
      const stop = routine('StopResellr');

      // `Exec` returns False when resellr-node.exe is missing: no resellr runs from the folder.
      expect(stop).toMatch(/if not Exec\([\s\S]*?then\s+begin\s+Result := True;\s+exit;\s+end;/);
      expect(stop).toMatch(/Result := ResultCode = 0;/);
    });

    it('DER-105-03 stops before the update replaces files and aborts it without change, with the message', () => {
      const prepare = routine('PrepareToInstall');

      expect(prepare).toMatch(
        /if StopResellr\(\) then\s+Result := ''\s+else\s+Result := StopFailedMessage\(\);/,
      );
      expect(routine('StopFailedMessage')).toContain(
        "'resellr konnte nicht beendet werden. Bitte sp' + #$00E4 + 'ter erneut versuchen.'",
      );
    });

    it('DER-105-05 stops after the question and before removing anything, and aborts with the suppressible message', () => {
      const uninstall = routine('CurUninstallStepChanged');

      expect(uninstall).toMatch(/\(CurUninstallStep = usAppMutexCheck\) and not StopResellr\(\)/);
      expect(uninstall).toMatch(
        /SuppressibleMsgBox\(StopFailedMessage\(\), mbError, MB_OK, IDOK\);\s+Abort;/,
      );
    });

    it('never ends Chrome or other processes itself during the uninstallation', () => {
      expect(code).not.toMatch(/chrome|taskkill|CloseApplications/i);
      expect(setup().CloseApplications).toBeUndefined();
    });
  });
});
