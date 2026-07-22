#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#include <unistd.h>
#include <sys/wait.h>
#include <signal.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, NSWindowDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (assign, nonatomic) pid_t rustPid;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    // 1. Start the Rust backend
    [self startRustBackend];

    // 2. Create the Cocoa window
    NSRect screenSize = [[NSScreen mainScreen] visibleFrame];
    CGFloat width = 1280;
    CGFloat height = 850;
    NSRect rect = NSMakeRect(
        (screenSize.size.width - width) / 2,
        (screenSize.size.height - height) / 2,
        width,
        height
    );

    NSUInteger styleMask = NSWindowStyleMaskTitled | 
                           NSWindowStyleMaskClosable | 
                           NSWindowStyleMaskMiniaturizable | 
                           NSWindowStyleMaskResizable;

    self.window = [[NSWindow alloc] initWithContentRect:rect
                                              styleMask:styleMask
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    self.window.title = @"Cameleer Secure Control Panel";
    self.window.titlebarAppearsTransparent = NO;
    self.window.titleVisibility = NSWindowTitleVisible;
    [self.window setMovable:YES];
    [self.window setMovableByWindowBackground:YES];
    self.window.releasedWhenClosed = NO;
    self.window.delegate = self;

    // 3. Set up WKWebView
    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:config];
    if (@available(macOS 13.3, *)) {
        [self.webView setInspectable:YES];
    }
    self.window.contentView = self.webView;

    // 4. Show window and load beautiful glassmorphic dark-theme loading screen
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];

    NSString *html = @"<html>"
                      "<head>"
                      "<style>"
                      "body {"
                      "  background: linear-gradient(135deg, #0b0f19 0%, #111827 100%);"
                      "  color: #f3f4f6;"
                      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"
                      "  display: flex;"
                      "  flex-direction: column;"
                      "  justify-content: center;"
                      "  align-items: center;"
                      "  height: 100vh;"
                      "  margin: 0;"
                      "  overflow: hidden;"
                      "}"
                      ".spinner {"
                      "  width: 50px;"
                      "  height: 50px;"
                      "  border: 4px solid rgba(99, 102, 241, 0.1);"
                      "  border-top-color: #6366f1;"
                      "  border-radius: 50%;"
                      "  animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;"
                      "  margin-bottom: 24px;"
                      "  box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);"
                      "}"
                      "@keyframes spin {"
                      "  to { transform: rotate(360deg); }"
                      "}"
                      "h2 {"
                      "  font-weight: 600;"
                      "  font-size: 20px;"
                      "  margin: 0 0 8px 0;"
                      "  background: linear-gradient(135deg, #a5b4fc, #6366f1, #818cf8);"
                      "  -webkit-background-clip: text;"
                      "  -webkit-text-fill-color: transparent;"
                      "  letter-spacing: -0.5px;"
                      "}"
                      "p {"
                      "  color: #9ca3af;"
                      "  font-size: 14px;"
                      "  margin: 0;"
                      "  letter-spacing: 0.2px;"
                      "}"
                      "</style>"
                      "</head>"
                      "<body>"
                      "  <div class='spinner'></div>"
                      "  <h2>Initializing Cameleer System</h2>"
                      "  <p>Connecting to secure local agent portal...</p>"
                      "</body>"
                      "</html>";
    [self.webView loadHTMLString:html baseURL:nil];

    // 5. Asynchronously check if the server is active, and transition when ready
    [self checkServerAndLoad];
}

- (void)checkServerAndLoad {
    NSURL *url = [NSURL URLWithString:@"http://127.0.0.1:8080/api/skills"];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url
                                                           cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
                                                       timeoutInterval:0.5];
    [request setHTTPMethod:@"GET"];
    
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request
                                                                 completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error == nil && [(NSHTTPURLResponse *)response statusCode] == 200) {
            // Server is ready! Load actual dashboard on main thread
            dispatch_async(dispatch_get_main_queue(), ^{
                NSURL *dashboardUrl = [NSURL URLWithString:@"http://127.0.0.1:8080"];
                NSURLRequest *dashboardRequest = [NSURLRequest requestWithURL:dashboardUrl];
                [self.webView loadRequest:dashboardRequest];
            });
        } else {
            // Try again in 200ms
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                [self checkServerAndLoad];
            });
        }
    }];
    [task resume];
}

- (void)startRustBackend {
    NSString *bundlePath = [[NSBundle mainBundle] bundlePath];
    NSString *execPath = [bundlePath stringByAppendingPathComponent:@"Contents/MacOS/cameleer"];
    
    BOOL isDir = NO;
    if (![[NSFileManager defaultManager] fileExistsAtPath:execPath isDirectory:&isDir]) {
        // Fallback for development/testing
        NSString *currentDir = [[NSFileManager defaultManager] currentDirectoryPath];
        execPath = [currentDir stringByAppendingPathComponent:@"target/release/cameleer"];
    }

    // Run onboard synchronously first
    pid_t onboardPid = fork();
    if (onboardPid == 0) {
        // Child process
        char *args[] = {(char *)[execPath UTF8String], "onboard", NULL};
        execv(args[0], args);
        exit(1);
    } else if (onboardPid > 0) {
        int status;
        waitpid(onboardPid, &status, 0);
    }

    // Run background backend process
    self.rustPid = fork();
    if (self.rustPid == 0) {
        // Ensure log directory exists
        NSString *home = NSHomeDirectory();
        NSString *logDir = [home stringByAppendingPathComponent:@".cameleer"];
        [[NSFileManager defaultManager] createDirectoryAtPath:logDir withIntermediateDirectories:YES attributes:nil error:nil];
        NSString *logFile = [logDir stringByAppendingPathComponent:@"cameleer.log"];
        
        // Redirect outputs to the log file for rich troubleshooting
        freopen([logFile UTF8String], "a", stdout);
        freopen([logFile UTF8String], "a", stderr);
        
        char *args[] = {(char *)[execPath UTF8String], "run", NULL};
        execv(args[0], args);
        exit(1);
    }
}

- (void)windowWillClose:(NSNotification *)notification {
    [NSApp terminate:self];
}

- (void)applicationWillTerminate:(NSNotification *)notification {
    if (self.rustPid > 0) {
        kill(self.rustPid, SIGTERM);
    }
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}
