using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

class CvAgentLauncher
{
    [DllImport("kernel32.dll")]
    static extern bool SetConsoleCtrlHandler(HandlerRoutine handler, bool add);
    delegate bool HandlerRoutine(uint ctrlType);

    private static readonly string Root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
    private static readonly string Standalone = Path.Combine(Root, ".next", "standalone");
    private static readonly string ServerFile = Path.Combine(Standalone, "server.js");
    private static readonly string BuildMarker = Path.Combine(Root, ".next", "BUILD_ID");
    private static readonly string NodeExe = "node.exe";
    private static readonly int Port = 3002;
    private static readonly string Url = "http://127.0.0.1:3002";
    private static Process _server;
    private static readonly string LogFile = Path.Combine(Root, "cv-agent.log");

    private static void Log(string msg)
    {
        try { File.AppendAllText(LogFile, "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + msg + Environment.NewLine); } catch { }
    }

    private static Process StartServer()
    {
        var psi = new ProcessStartInfo
        {
            FileName = NodeExe,
            Arguments = "\"server.js\"",
            WorkingDirectory = Standalone,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };

        psi.Environment["PORT"] = Port.ToString();
        psi.Environment["HOSTNAME"] = "127.0.0.1";
        LoadEnvFile(psi);

        var p = new Process { StartInfo = psi };
        p.OutputDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) Log("[server] " + e.Data); };
        p.ErrorDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) Log("[server] " + e.Data); };
        p.Start();
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        return p;
    }

    private static void LoadEnvFile(ProcessStartInfo psi)
    {
        var envFile = Path.Combine(Root, ".env");
        if (!File.Exists(envFile)) return;
        foreach (var line in File.ReadAllLines(envFile))
        {
            var t = line.Trim();
            if (t.Length == 0 || t.StartsWith("#")) continue;
            var idx = t.IndexOf('=');
            if (idx <= 0) continue;
            var key = t.Substring(0, idx).Trim();
            var val = t.Substring(idx + 1).Trim();
            if (key.Length > 0) psi.Environment[key] = val;
        }
    }

    private static bool WaitForServer(int timeoutSeconds)
    {
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSeconds);
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(Url + "/api/status");
                req.Timeout = 3000;
                using (var resp = (HttpWebResponse)req.GetResponse())
                {
                    if (resp.StatusCode == HttpStatusCode.OK) return true;
                }
            }
            catch { }
            Thread.Sleep(1000);
        }
        return false;
    }

    private static bool ServerAlreadyRunning()
    {
        try
        {
            var client = new TcpClient();
            var ar = client.BeginConnect("127.0.0.1", Port, null, null);
            if (!ar.AsyncWaitHandle.WaitOne(800)) { client.Close(); return false; }
            client.EndConnect(ar);
            client.Close();
            return true;
        }
        catch { return false; }
    }

    private static bool SourcesNewerThanBuild()
    {
        if (!File.Exists(BuildMarker)) return true;
        var buildTime = File.GetLastWriteTimeUtc(BuildMarker);
        var dirs = new[] { "src", "prisma" };
        foreach (var d in dirs)
        {
            var dir = Path.Combine(Root, d);
            if (!Directory.Exists(dir)) continue;
            foreach (var f in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
            {
                try { if (File.GetLastWriteTimeUtc(f) > buildTime) return true; } catch { }
            }
        }
        foreach (var f in new[] { "next.config.ts", "package.json" })
        {
            var path = Path.Combine(Root, f);
            if (File.Exists(path) && File.GetLastWriteTimeUtc(path) > buildTime) return true;
        }
        return false;
    }

    private static int RunBuild()
    {
        Console.WriteLine("  Construction de l'application (premier lancement ou code modifié)...");
        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/c \"npx next build\"",
            WorkingDirectory = Root,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        var p = Process.Start(psi);
        p.OutputDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) Console.WriteLine("    " + e.Data); };
        p.ErrorDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) Console.WriteLine("    " + e.Data); };
        p.Start();
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        p.WaitForExit();

        try
        {
            var staticSrc = Path.Combine(Root, ".next", "static");
            var staticDst = Path.Combine(Standalone, ".next", "static");
            if (Directory.Exists(staticSrc)) CopyDir(staticSrc, staticDst);
            var publicSrc = Path.Combine(Root, "public");
            var publicDst = Path.Combine(Standalone, "public");
            if (Directory.Exists(publicSrc)) CopyDir(publicSrc, publicDst);
            Console.WriteLine("  Assets copiés dans le standalone.");
        }
        catch (Exception ex)
        {
            Console.WriteLine("  ATTENTION copie assets : " + ex.Message);
        }
        return p.ExitCode;
    }

    private static void CopyDir(string src, string dst)
    {
        Directory.CreateDirectory(dst);
        foreach (var f in Directory.GetFiles(src))
            File.Copy(f, Path.Combine(dst, Path.GetFileName(f)), true);
        foreach (var d in Directory.GetDirectories(src))
            CopyDir(d, Path.Combine(dst, Path.GetFileName(d)));
    }

    static void Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.Title = "CV -> Word / PowerPoint (agent local)";
        Console.WriteLine("===============================================");
        Console.WriteLine("  Agent de Transformation de CV  (localhost)");
        Console.WriteLine("===============================================");

        SetConsoleCtrlHandler(SigHandler, true);

        if (ServerAlreadyRunning())
        {
            Console.WriteLine("  Le serveur est deja en cours d'execution sur le port " + Port + ".");
            Console.WriteLine("  Ouverture du navigateur...");
            OpenBrowser();
            Console.WriteLine("  Fermez cette fenetre pour quitter.");
            WaitLoop();
            return;
        }

        try
        {
            if (!File.Exists(ServerFile) || SourcesNewerThanBuild())
            {
                if (RunBuild() != 0)
                {
                    Console.WriteLine("  ERREUR : la construction a echoue. Journal : " + LogFile);
                    Console.ReadLine();
                    return;
                }
            }

            Console.WriteLine("  Demarrage du serveur...");
            _server = StartServer();

            Console.WriteLine("  http://127.0.0.1:" + Port + "  --  patientez quelques secondes...");
            if (WaitForServer(90))
            {
                Console.WriteLine("  Serveur pret. Ouverture du navigateur...");
                OpenBrowser();
            }
            else
            {
                Console.WriteLine("  ATTENTION : le serveur ne repond pas encore. Verifiez " + LogFile + ".");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("  ERREUR : " + ex.Message);
            Log("ERROR: " + ex);
            Console.ReadLine();
            return;
        }

        Console.WriteLine("  L'application tourne en arriere-plan.");
        Console.WriteLine("  Fermez cette fenetre (ou Ctrl+C) pour arreter le serveur.");
        Console.WriteLine("  Journal : " + LogFile);

        WaitLoop();
    }

    private static void WaitLoop()
    {
        var done = new ManualResetEvent(false);
        WaitHandle.WaitAll(new[] { done });
    }

    private static bool SigHandler(uint ctrlType)
    {
        Log("Arret du serveur...");
        try { if (_server != null && !_server.HasExited) { _server.Kill(); _server.WaitForExit(5000); } } catch { }
        return true;
    }

    private static void OpenBrowser()
    {
        try { Process.Start(new ProcessStartInfo("cmd", "/c start " + Url) { UseShellExecute = false }); }
        catch { try { Process.Start(Url); } catch { } }
    }
}