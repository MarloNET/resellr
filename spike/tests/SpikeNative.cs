// Native helpers for the Windows spike test scripts (loaded with Add-Type). Test tooling only.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public sealed class SpikeProc
{
    public int Pid;
    public IntPtr Handle;
    public long StartedMs;

    public bool HasExited { get { return SpikeNative.WaitForSingleObject(Handle, 0) == 0; } }

    // Returns the exit code, or null when the process is still running after timeoutMs.
    public long? WaitExit(int timeoutMs)
    {
        if (SpikeNative.WaitForSingleObject(Handle, (uint)timeoutMs) != 0) return null;
        uint code;
        SpikeNative.GetExitCodeProcess(Handle, out code);
        return code;
    }

    public long CreateMs { get { return Times()[0]; } }

    public long? ExitMs
    {
        get
        {
            if (!HasExited) return null;
            return Times()[1];
        }
    }

    private long[] Times()
    {
        long creation, exit, kernel, user;
        if (!SpikeNative.GetProcessTimes(Handle, out creation, out exit, out kernel, out user))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        return new long[] { SpikeNative.FileTimeToUnixMs(creation), SpikeNative.FileTimeToUnixMs(exit) };
    }
}

public static class SpikeNative
{
    public const uint CREATE_NEW_CONSOLE = 0x00000010;
    public const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
    public const uint CREATE_NO_WINDOW = 0x08000000;
    const uint LOGON_WITH_PROFILE = 1;
    const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    const uint SYNCHRONIZE = 0x00100000;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION
    {
        public IntPtr hProcess, hThread;
        public int dwProcessId, dwThreadId;
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool CreateProcessWithLogonW(string user, string domain, string password, uint logonFlags,
        string applicationName, StringBuilder commandLine, uint creationFlags, IntPtr environment,
        string currentDirectory, ref STARTUPINFO startupInfo, out PROCESS_INFORMATION processInfo);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern uint WaitForSingleObject(IntPtr handle, uint ms);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool GetExitCodeProcess(IntPtr handle, out uint code);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool GetProcessTimes(IntPtr handle, out long creation, out long exit, out long kernel, out long user);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint access, bool inherit, int pid);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool ProcessIdToSessionId(uint pid, out uint session);

    [DllImport("imagehlp.dll", CharSet = CharSet.Unicode)]
    static extern uint MapFileAndCheckSumW(string file, out uint headerSum, out uint checkSum);

    delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hwnd);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);

    public static long FileTimeToUnixMs(long fileTime)
    {
        return fileTime / 10000 - 11644473600000L;
    }

    public static long NowMs()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    // Starts a process as a local user via CreateProcessWithLogonW with LOGON_WITH_PROFILE
    // (the API behind Start-Process -Credential -LoadUserProfile). The environment is built
    // from the user's profile (lpEnvironment = NULL) and the desktop is inherited.
    public static SpikeProc StartAsUser(string user, string password, string commandLine, string currentDirectory, uint creationFlags)
    {
        var si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
        PROCESS_INFORMATION pi;
        var cmd = new StringBuilder(commandLine, Math.Max(commandLine.Length + 1, 1024));
        long started = NowMs();
        if (!CreateProcessWithLogonW(user, ".", password, LOGON_WITH_PROFILE, null, cmd,
                creationFlags | CREATE_UNICODE_ENVIRONMENT, IntPtr.Zero, currentDirectory, ref si, out pi))
        {
            int err = Marshal.GetLastWin32Error();
            throw new Win32Exception(err, "CreateProcessWithLogonW failed (" + err + "): " + new Win32Exception(err).Message);
        }
        CloseHandle(pi.hThread);
        return new SpikeProc { Pid = pi.dwProcessId, Handle = pi.hProcess, StartedMs = started };
    }

    // Opens a handle to an existing process so exit code and exit time stay readable after it ends.
    public static SpikeProc OpenProc(int pid)
    {
        IntPtr handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, false, pid);
        if (handle == IntPtr.Zero) return null;
        return new SpikeProc { Pid = pid, Handle = handle, StartedMs = 0 };
    }

    public static long SessionOf(int pid)
    {
        uint session;
        return ProcessIdToSessionId((uint)pid, out session) ? session : -1;
    }

    // Returns { status, headerSum, computedSum }; status 0 = CHECKSUM_SUCCESS.
    public static long[] MapFileAndCheckSum(string file)
    {
        uint header, computed;
        uint status = MapFileAndCheckSumW(file, out header, out computed);
        return new long[] { status, header, computed };
    }

    // Offsets (at most maxReport) where a and b differ in the first min(a, b) bytes, ignoring excluded offsets.
    public static long[] DiffExcept(byte[] a, byte[] b, long[] excluded, int maxReport)
    {
        var skip = new HashSet<long>(excluded);
        var diffs = new List<long>();
        long n = Math.Min(a.LongLength, b.LongLength);
        for (long i = 0; i < n; i++)
        {
            if (a[i] != b[i] && !skip.Contains(i))
            {
                diffs.Add(i);
                if (diffs.Count >= maxReport) break;
            }
        }
        return diffs.ToArray();
    }

    // Window watcher: every intervalMs, enumerates visible top-level windows and logs when a window
    // of a watched process appears or disappears. Windows present at the first scan are marked preexisting.
    public static void WindowWatch(string csvPath, string stopFile, string readyFile, int intervalMs, string[] watchedNames)
    {
        var watched = new HashSet<string>(watchedNames, StringComparer.OrdinalIgnoreCase);
        var known = new Dictionary<IntPtr, string>();
        long iterations = 0;
        int ownSession = (int)SessionOf(Process.GetCurrentProcess().Id);
        using (var w = new StreamWriter(csvPath, false, new UTF8Encoding(false)))
        {
            w.AutoFlush = true;
            w.WriteLine("ts,event,hwnd,pid,name,session,preexisting,title");
            w.WriteLine(NowMs() + ",start,,"+ Process.GetCurrentProcess().Id + ",window-watch," + ownSession + ",,");
            bool first = true;
            var sw = Stopwatch.StartNew();
            long lastHeartbeat = 0;
            while (true)
            {
                if (iterations % 20 == 0 && File.Exists(stopFile)) break;
                long ts = NowMs();
                var visible = new List<IntPtr>();
                EnumWindows((h, l) => { if (IsWindowVisible(h)) visible.Add(h); return true; }, IntPtr.Zero);
                var seen = new HashSet<IntPtr>();
                foreach (var h in visible)
                {
                    seen.Add(h);
                    if (known.ContainsKey(h)) continue;
                    uint pid;
                    GetWindowThreadProcessId(h, out pid);
                    string name = NameOf(pid);
                    known[h] = pid + "," + name;
                    if (!watched.Contains(name)) continue;
                    var title = new StringBuilder(256);
                    GetWindowText(h, title, 256);
                    w.WriteLine(ts + ",appear," + h.ToInt64() + "," + pid + "," + name + "," + SessionOf((int)pid) + "," +
                        (first ? 1 : 0) + "," + Csv(title.ToString()));
                }
                var gone = new List<IntPtr>();
                foreach (var kv in known) if (!seen.Contains(kv.Key)) gone.Add(kv.Key);
                foreach (var h in gone)
                {
                    string pidAndName = known[h];
                    known.Remove(h);
                    if (watched.Contains(pidAndName.Substring(pidAndName.IndexOf(',') + 1)))
                        w.WriteLine(ts + ",disappear," + h.ToInt64() + "," + pidAndName + ",,,");
                }
                if (first)
                {
                    first = false;
                    File.WriteAllText(readyFile, "ready");
                }
                iterations++;
                if (ts - lastHeartbeat >= 1000)
                {
                    w.WriteLine(ts + ",heartbeat," + iterations + ",,,,," + sw.ElapsedMilliseconds);
                    lastHeartbeat = ts;
                }
                Thread.Sleep(intervalMs);
            }
            w.WriteLine(NowMs() + ",stop," + iterations + ",,,,," + sw.ElapsedMilliseconds);
        }
    }

    static string NameOf(uint pid)
    {
        try { return Process.GetProcessById((int)pid).ProcessName + ".exe"; }
        catch { return "?"; }
    }

    static string Csv(string s)
    {
        return "\"" + (s ?? "").Replace("\"", "\"\"") + "\"";
    }
}
