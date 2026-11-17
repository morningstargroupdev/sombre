use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use base64::Engine;

fn checked(to: &Path) -> Result<(), String> {
    let bytes = fs::read(to).unwrap_or_default();
    if sombre_harness::image::kind(&bytes).is_some() {
        Ok(())
    } else {
        let _ = fs::remove_file(to);
        Err("there's no image on the clipboard".to_string())
    }
}

#[cfg(target_os = "macos")]
pub fn image(to: &Path) -> Result<(), String> {
    let place = to.display().to_string().replace('"', "\\\"");
    let _ = Command::new("osascript")
        .args([
            "-e",
            &format!("set f to open for access POSIX file \"{place}\" with write permission"),
            "-e",
            "try",
            "-e",
            "write (the clipboard as «class PNGf») to f",
            "-e",
            "end try",
            "-e",
            "close access f",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    checked(to)
}

#[cfg(all(unix, not(target_os = "macos")))]
pub fn image(to: &Path) -> Result<(), String> {
    let read = |program: &str, args: &[&str]| {
        Command::new(program)
            .args(args)
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .ok()
            .filter(|output| output.status.success() && !output.stdout.is_empty())
            .map(|output| output.stdout)
    };
    let bytes = read("wl-paste", &["--type", "image/png"]).or_else(|| {
        read(
            "xclip",
            &["-selection", "clipboard", "-t", "image/png", "-o"],
        )
    });
    match bytes {
        Some(bytes) => fs::write(to, bytes).map_err(|error| error.to_string())?,
        None => {
            let windows = read("wslpath", &["-w", &to.display().to_string()])
                .map(|path| String::from_utf8_lossy(&path).trim().to_string());
            if let Some(windows) = windows {
                let _ = Command::new("powershell.exe")
                    .args(["-NoProfile", "-Command", &save(&windows)])
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status();
            }
        }
    }
    checked(to)
}

#[cfg(windows)]
pub fn image(to: &Path) -> Result<(), String> {
    let _ = Command::new("powershell")
        .args(["-NoProfile", "-Command", &save(&to.display().to_string())])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    checked(to)
}

#[cfg(not(target_os = "macos"))]
fn save(path: &str) -> String {
    format!(
        "Add-Type -AssemblyName System.Windows.Forms; $i = [System.Windows.Forms.Clipboard]::GetImage(); if ($i) {{ $i.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png) }}",
        path.replace('\'', "''")
    )
}

fn pipe(program: &str, args: &[&str], text: &str) -> bool {
    let Ok(mut child) = Command::new(program)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    else {
        return false;
    };
    let wrote = child
        .stdin
        .take()
        .is_some_and(|mut input| input.write_all(text.as_bytes()).is_ok());
    child.wait().is_ok_and(|status| status.success()) && wrote
}

#[cfg(target_os = "macos")]
fn native(text: &str) -> bool {
    pipe("pbcopy", &[], text)
}

#[cfg(all(unix, not(target_os = "macos")))]
fn native(text: &str) -> bool {
    pipe("wl-copy", &[], text)
        || pipe("xclip", &["-selection", "clipboard"], text)
        || pipe("xsel", &["--clipboard", "--input"], text)
        || pipe("clip.exe", &[], text)
}

#[cfg(windows)]
fn native(text: &str) -> bool {
    pipe("clip", &[], text)
}

pub fn copy(text: &str) -> bool {
    if std::env::var_os("SSH_CONNECTION").is_none() && native(text) {
        return true;
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(text);
    print!("\u{1b}]52;c;{encoded}\u{7}");
    std::io::stdout().flush().is_ok()
}
