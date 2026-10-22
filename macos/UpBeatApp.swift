import Cocoa
import WebKit
import MediaPlayer

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var backendProcess: Process?
    let serverURL = URL(string: "http://127.0.0.1:8000")!
    let workspacePath = "/Users/aaradhya/Documents/Programming/random"
    let appVersion = "3.0.0"
    let githubRepo = "AARADHYA-NEGI/UpBeat"

    var updateTimer: Timer?
    var isUpdating = false
    var backgroundActivity: NSObjectProtocol?

    var statusItem: NSStatusItem!
    var playPauseMenuItem: NSMenuItem!
    var trackTitleMenuItem: NSMenuItem!
    var currentTrackTitle = "UpBeat"
    var currentArtist = ""
    var isPlayingAudio = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.appearance = NSAppearance(named: .darkAqua)

        // Prevent macOS App Nap from throttling or suspending background playback
        backgroundActivity = ProcessInfo.processInfo.beginActivity(
            options: [.userInitiatedAllowingIdleSystemSleep, .latencyCritical],
            reason: "UpBeat Background Music Playback"
        )

        setupMenu()
        setupStatusBarItem()
        setupRemoteCommands()

        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1360, height: 860)
        let width: CGFloat = min(1380, screenRect.width * 0.92)
        let height: CGFloat = min(860, screenRect.height * 0.90)
        let rect = NSRect(
            x: screenRect.origin.x + (screenRect.width - width) / 2,
            y: screenRect.origin.y + (screenRect.height - height) / 2,
            width: width,
            height: height
        )

        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "UpBeat"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(calibratedRed: 0.051, green: 0.051, blue: 0.059, alpha: 1.0)
        window.minSize = NSSize(width: 900, height: 600)
        window.delegate = self

        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        if #available(macOS 10.15, *) {
            config.allowsAirPlayForMediaPlayback = true
        }
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.userContentController.add(self, name: "upbeatNative")

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15 UpBeatMac/\(appVersion)"

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        ensureBackendAndLoad()

        // Background check for updates 6 seconds after launch, then every 3 hours
        DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) { [weak self] in
            self?.checkForUpdates(silent: true)
        }
        updateTimer = Timer.scheduledTimer(withTimeInterval: 10800, repeats: true) { [weak self] _ in
            self?.checkForUpdates(silent: true)
        }
    }

    func setupStatusBarItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "♫"
            button.toolTip = "UpBeat Music Studio"
        }

        let menu = NSMenu()
        trackTitleMenuItem = NSMenuItem(title: "UpBeat: Ready", action: nil, keyEquivalent: "")
        trackTitleMenuItem.isEnabled = false
        menu.addItem(trackTitleMenuItem)
        menu.addItem(NSMenuItem.separator())

        playPauseMenuItem = NSMenuItem(title: "Play", action: #selector(togglePlayFromMenu), keyEquivalent: " ")
        menu.addItem(playPauseMenuItem)

        menu.addItem(NSMenuItem(title: "Next Track", action: #selector(nextTrackFromMenu), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Previous Track", action: #selector(prevTrackFromMenu), keyEquivalent: ""))

        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Open UpBeat Window", action: #selector(showMainWindow), keyEquivalent: "o")
        menu.addItem(withTitle: "Quit UpBeat", action: #selector(quitApp), keyEquivalent: "q")

        statusItem.menu = menu
    }

    @objc func togglePlayFromMenu() {
        webView.evaluateJavaScript("window.UpBeatControls?.togglePlay?.()")
    }

    @objc func nextTrackFromMenu() {
        webView.evaluateJavaScript("window.UpBeatControls?.next?.()")
    }

    @objc func prevTrackFromMenu() {
        webView.evaluateJavaScript("window.UpBeatControls?.prev?.()")
    }

    @objc func showMainWindow() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func quitApp() {
        NSApplication.shared.terminate(nil)
    }

    func setupRemoteCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.isEnabled = true
        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.webView.evaluateJavaScript("window.UpBeatControls?.play?.()")
            return .success
        }

        commandCenter.pauseCommand.isEnabled = true
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.webView.evaluateJavaScript("window.UpBeatControls?.pause?.()")
            return .success
        }

        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.webView.evaluateJavaScript("window.UpBeatControls?.togglePlay?.()")
            return .success
        }

        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.webView.evaluateJavaScript("window.UpBeatControls?.next?.()")
            return .success
        }

        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.webView.evaluateJavaScript("window.UpBeatControls?.prev?.()")
            return .success
        }

        commandCenter.changePlaybackPositionCommand.isEnabled = true
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            if let pos = event as? MPChangePlaybackPositionCommandEvent {
                self?.webView.evaluateJavaScript("window.UpBeatControls?.seekTo?.(\(pos.positionTime))")
                return .success
            }
            return .commandFailed
        }
    }

    func updateNowPlayingInfo(title: String, artist: String, duration: Double, currentTime: Double, isPlaying: Bool) {
        var info = [String: Any]()
        info[MPMediaItemPropertyTitle] = title
        info[MPMediaItemPropertyArtist] = artist.isEmpty ? "UpBeat" : artist
        info[MPMediaItemPropertyAlbumTitle] = "UpBeat"
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        }
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "upbeatNative",
              let body = message.body as? [String: Any] else { return }

        let isPlaying = (body["isPlaying"] as? Bool) ?? false
        let title = (body["title"] as? String) ?? "UpBeat"
        let artist = (body["artist"] as? String) ?? ""
        let duration = (body["duration"] as? Double) ?? 0
        let currentTime = (body["currentTime"] as? Double) ?? 0

        self.isPlayingAudio = isPlaying
        self.currentTrackTitle = title
        self.currentArtist = artist

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let button = self.statusItem?.button {
                if isPlaying {
                    let cleanTitle = title.count > 18 ? String(title.prefix(18)) + "…" : title
                    button.title = "▶ \(cleanTitle)"
                } else {
                    button.title = "♫"
                }
            }
            self.trackTitleMenuItem?.title = artist.isEmpty ? title : "\(title) — \(artist)"
            self.playPauseMenuItem?.title = isPlaying ? "Pause" : "Play"

            self.updateNowPlayingInfo(
                title: title,
                artist: artist,
                duration: duration,
                currentTime: currentTime,
                isPlaying: isPlaying
            )
        }
    }

    // Keep app running in background when window is closed (like Spotify / Apple Music)
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        return true
    }

    func setupMenu() {
        let mainMenu = NSMenu()

        // App Menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About UpBeat (v\(appVersion))", action: #selector(showAboutPanel), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Check for Updates...", action: #selector(menuCheckForUpdates), keyEquivalent: "u")
        appMenu.addItem(withTitle: "Update Studio Now", action: #selector(menuRunSelfUpdate), keyEquivalent: "U")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Reload Studio", action: #selector(reloadPage), keyEquivalent: "r")
        appMenu.addItem(withTitle: "Hard Refresh", action: #selector(hardReloadPage), keyEquivalent: "R")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit UpBeat", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu

        // Edit Menu (Cmd+C, Cmd+V, Cmd+A, Cmd+X in text fields)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu

        // View Menu
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Actual Size", action: #selector(resetZoom), keyEquivalent: "0")
        viewMenu.addItem(withTitle: "Zoom In", action: #selector(zoomIn), keyEquivalent: "+")
        viewMenu.addItem(withTitle: "Zoom Out", action: #selector(zoomOut), keyEquivalent: "-")
        viewMenu.addItem(NSMenuItem.separator())
        viewMenu.addItem(withTitle: "Toggle Full Screen", action: #selector(toggleFullScreen), keyEquivalent: "f")
        viewMenuItem.submenu = viewMenu

        NSApp.mainMenu = mainMenu
    }

    @objc func showAboutPanel() {
        let alert = NSAlert()
        alert.messageText = "UpBeat Studio"
        alert.informativeText = "Version \(appVersion) (Direct Search & AI Studio)\nCreated for modern music curation with zero-token search, YouTube Music streaming, background playback, and Safari sync."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Check for Updates")
        let res = alert.runModal()
        if res == .alertSecondButtonReturn {
            checkForUpdates(silent: false)
        }
    }

    @objc func reloadPage() {
        webView.reload()
    }

    @objc func hardReloadPage() {
        webView.reloadFromOrigin()
    }

    @objc func resetZoom() {
        webView.pageZoom = 1.0
    }

    @objc func zoomIn() {
        webView.pageZoom += 0.1
    }

    @objc func zoomOut() {
        webView.pageZoom = max(0.5, webView.pageZoom - 0.1)
    }

    @objc func toggleFullScreen() {
        window.toggleFullScreen(nil)
    }

    @objc func menuCheckForUpdates() {
        checkForUpdates(silent: false)
    }

    @objc func menuRunSelfUpdate() {
        runSelfUpdate(userTriggered: true)
    }

    func checkForUpdates(silent: Bool) {
        if isUpdating { return }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            var hasGitUpdate = false
            var latestGitMsg = ""

            // 1. Check local git repo if available
            let gitPath = "\(self.workspacePath)/.git"
            if FileManager.default.fileExists(atPath: gitPath) {
                let fetchProc = Process()
                fetchProc.executableURL = URL(fileURLWithPath: "/usr/bin/git")
                fetchProc.arguments = ["fetch", "origin", "main"]
                fetchProc.currentDirectoryURL = URL(fileURLWithPath: self.workspacePath)
                try? fetchProc.run()
                fetchProc.waitUntilExit()

                let diffProc = Process()
                let diffPipe = Pipe()
                diffProc.executableURL = URL(fileURLWithPath: "/usr/bin/git")
                diffProc.arguments = ["log", "HEAD..origin/main", "--oneline", "-n", "3"]
                diffProc.currentDirectoryURL = URL(fileURLWithPath: self.workspacePath)
                diffProc.standardOutput = diffPipe
                try? diffProc.run()
                diffProc.waitUntilExit()

                let diffData = diffPipe.fileHandleForReading.readDataToEndOfFile()
                let diffOut = String(data: diffData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if !diffOut.isEmpty {
                    hasGitUpdate = true
                    latestGitMsg = diffOut
                }
            }

            // 2. Also check GitHub releases API
            let releaseURL = URL(string: "https://api.github.com/repos/\(self.githubRepo)/releases/latest")!
            var req = URLRequest(url: releaseURL)
            req.setValue("UpBeat-MacUpdater", forHTTPHeaderField: "User-Agent")
            req.timeoutInterval = 4.0

            let sem = DispatchSemaphore(value: 0)
            var releaseTag = ""

            URLSession.shared.dataTask(with: req) { data, _, _ in
                if let d = data,
                   let json = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                   let tag = json["tag_name"] as? String {
                    releaseTag = tag
                }
                sem.signal()
            }.resume()
            _ = sem.wait(timeout: .now() + 4.5)

            let hasReleaseUpdate = !releaseTag.isEmpty && !releaseTag.contains(self.appVersion) && releaseTag > "v\(self.appVersion)"

            DispatchQueue.main.async {
                if hasGitUpdate || hasReleaseUpdate {
                    let alert = NSAlert()
                    alert.messageText = "New UpBeat Update Available"
                    var detail = "A newer version of UpBeat is ready to install.\n\n"
                    if !latestGitMsg.isEmpty {
                        detail += "Latest changes:\n\(latestGitMsg)\n\n"
                    } else if !releaseTag.isEmpty {
                        detail += "Release: \(releaseTag)\n\n"
                    }
                    detail += "Would you like to recompile and update now?"
                    alert.informativeText = detail
                    alert.addButton(withTitle: "Update Now")
                    alert.addButton(withTitle: "Later")

                    let response = alert.runModal()
                    if response == .alertFirstButtonReturn {
                        self.runSelfUpdate(userTriggered: true)
                    }
                } else if !silent {
                    let alert = NSAlert()
                    alert.messageText = "UpBeat is Up to Date"
                    alert.informativeText = "You are running UpBeat v\(self.appVersion).\n\nNo newer updates found on GitHub (\(releaseTag.isEmpty ? "latest" : releaseTag))."
                    alert.addButton(withTitle: "OK")
                    alert.runModal()
                }
            }
        }
    }

    func runSelfUpdate(userTriggered: Bool) {
        if isUpdating { return }
        isUpdating = true

        let scriptPath = "\(workspacePath)/macos/update.sh"
        guard FileManager.default.fileExists(atPath: scriptPath) else {
            isUpdating = false
            let errAlert = NSAlert()
            errAlert.messageText = "Update Script Missing"
            errAlert.informativeText = "Could not find \(scriptPath)"
            errAlert.runModal()
            return
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            let proc = Process()
            let pipe = Pipe()
            proc.executableURL = URL(fileURLWithPath: "/bin/bash")
            proc.arguments = [scriptPath]
            proc.currentDirectoryURL = URL(fileURLWithPath: self.workspacePath)
            proc.standardOutput = pipe
            proc.standardError = pipe

            do {
                try proc.run()
                proc.waitUntilExit()
                let success = proc.terminationStatus == 0

                DispatchQueue.main.async {
                    self.isUpdating = false
                    if success {
                        self.webView.reload()
                        let finishAlert = NSAlert()
                        finishAlert.messageText = "UpBeat Updated Successfully"
                        finishAlert.informativeText = "The latest UpBeat version has been compiled and the studio has reloaded."
                        finishAlert.addButton(withTitle: "Great")
                        finishAlert.runModal()
                    } else {
                        let errData = pipe.fileHandleForReading.readDataToEndOfFile()
                        let errText = String(data: errData, encoding: .utf8) ?? "Unknown error"
                        let errAlert = NSAlert()
                        errAlert.messageText = "Update Failed"
                        errAlert.informativeText = String(errText.suffix(400))
                        errAlert.addButton(withTitle: "OK")
                        errAlert.runModal()
                    }
                }
            } catch {
                DispatchQueue.main.async {
                    self.isUpdating = false
                    let errAlert = NSAlert()
                    errAlert.messageText = "Failed to Run Updater"
                    errAlert.informativeText = "\(error)"
                    errAlert.runModal()
                }
            }
        }
    }

    func ensureBackendAndLoad() {
        let statusURL = URL(string: "http://127.0.0.1:8000/api/status")!
        var req = URLRequest(url: statusURL)
        req.timeoutInterval = 1.2

        URLSession.shared.dataTask(with: req) { [weak self] _, response, _ in
            guard let self = self else { return }
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                DispatchQueue.main.async {
                    self.webView.load(URLRequest(url: self.serverURL))
                }
            } else {
                self.startBackendProcess()
            }
        }.resume()
    }

    func startBackendProcess() {
        let proc = Process()
        let venvPython = "\(workspacePath)/.venv/bin/python"
        let venvUvicorn = "\(workspacePath)/.venv/bin/uvicorn"

        var env = ProcessInfo.processInfo.environment
        env["VIRTUAL_ENV"] = "\(workspacePath)/.venv"
        env["PATH"] = "\(workspacePath)/.venv/bin:/usr/local/bin:/usr/bin:/bin:\(env["PATH"] ?? "")"
        env["PYTHONPATH"] = workspacePath
        proc.environment = env

        if FileManager.default.fileExists(atPath: venvUvicorn) {
            proc.executableURL = URL(fileURLWithPath: venvUvicorn)
            proc.arguments = ["argon_music.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
        } else {
            proc.executableURL = URL(fileURLWithPath: venvPython)
            proc.arguments = ["-m", "uvicorn", "argon_music.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
        }
        proc.currentDirectoryURL = URL(fileURLWithPath: workspacePath)

        do {
            try proc.run()
            self.backendProcess = proc
        } catch {
            print("Failed to launch backend: \(error)")
        }

        pollBackend(attemptsLeft: 30)
    }

    func pollBackend(attemptsLeft: Int) {
        guard attemptsLeft > 0 else { return }
        let statusURL = URL(string: "http://127.0.0.1:8000/api/status")!
        var req = URLRequest(url: statusURL)
        req.timeoutInterval = 1.0

        URLSession.shared.dataTask(with: req) { [weak self] _, response, _ in
            guard let self = self else { return }
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                DispatchQueue.main.async {
                    self.webView.load(URLRequest(url: self.serverURL))
                }
            } else {
                DispatchQueue.global().asyncAfter(deadline: .now() + 0.4) {
                    self.pollBackend(attemptsLeft: attemptsLeft - 1)
                }
            }
        }.resume()
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func applicationWillTerminate(_ notification: Notification) {
        updateTimer?.invalidate()
        if let act = backgroundActivity {
            ProcessInfo.processInfo.endActivity(act)
        }
        if let proc = backendProcess, proc.isRunning {
            proc.terminate()
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
