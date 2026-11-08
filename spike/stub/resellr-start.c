// P2.R fallback S2 (ADR-008), throwaway spike code: GUI-subsystem start stub. Starts the unchanged,
// signed node.exe next to this file with CREATE_NO_WINDOW and the passed arguments, waits for it
// and returns its exit code. Build: cl /nologo /O2 resellr-start.c /link /SUBSYSTEM:WINDOWS
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <wchar.h>

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR args, int show)
{
    wchar_t exe[MAX_PATH];
    DWORD len = GetModuleFileNameW(NULL, exe, MAX_PATH);
    if (len == 0 || len >= MAX_PATH) return 1;
    wchar_t *slash = wcsrchr(exe, L'\\');
    if (!slash) return 1;
    if (wcscpy_s(slash + 1, MAX_PATH - (slash + 1 - exe), L"node.exe") != 0) return 1;

    size_t size = wcslen(exe) + wcslen(args) + 4;
    wchar_t *commandLine = (wchar_t *)malloc(size * sizeof(wchar_t));
    if (!commandLine) return 1;
    swprintf(commandLine, size, L"\"%s\" %s", exe, args);

    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    if (!CreateProcessW(exe, commandLine, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        free(commandLine);
        return 1;
    }
    free(commandLine);
    CloseHandle(pi.hThread);
    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD code = 1;
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hProcess);
    return (int)code;
}
