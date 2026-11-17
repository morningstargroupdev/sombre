use std::path::Path;
use std::process::Child;
use std::sync::Mutex;

static AWAKE: Mutex<Option<Child>> = Mutex::new(None);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lid {
    Sleeps,
    Running,
    Stuck,
    Missing,
}

pub fn disabled(settings: &str) -> bool {
    settings.lines().any(|line| {
        let mut words = line.split_whitespace();
        words.next() == Some("SleepDisabled") && words.next() == Some("1")
    })
}

pub fn reading(battery: &str) -> Option<String> {
    let source = if battery.contains("'AC Power'") {
        "plugged in"
    } else if battery.contains("'Battery Power'") {
        "on battery"
    } else {
        return None;
    };
    let level = battery
        .split(|character: char| character.is_whitespace() || character == ';')
        .find(|word| word.len() > 1 && word.ends_with('%'));
    Some(level.map_or_else(|| source.to_string(), |level| format!("{source}, {level}")))
}

pub fn awakened() -> bool {
    AWAKE.lock().is_ok_and(|held| held.is_some())
}

#[cfg(target_os = "macos")]
mod mac {
    use std::path::Path;
    use std::process::{Command, Stdio};
    use std::thread;
    use std::time::Duration;

    const HELPER: &str = r#"pmset -a disablesleep 1
while kill -0 "$1" 2>/dev/null && [ -e "$2" ]; do
  case "$(pmset -g batt)" in
    *discharging*)
      left=$(pmset -g batt | grep -o '[0-9]*%' | head -1 | tr -d %)
      [ "${left:-100}" -lt 20 ] && break ;;
  esac
  sleep 5
done
pmset -a disablesleep 0
rm -f "$2""#;

    pub fn pmset(args: &[&str]) -> String {
        Command::new("/usr/bin/pmset")
            .args(args)
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).into_owned())
            .unwrap_or_default()
    }

    pub fn alive(mark: &Path) -> bool {
        std::fs::read_to_string(mark)
            .ok()
            .and_then(|pid| pid.trim().parse::<i32>().ok())
            .is_some_and(|pid| {
                nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid), None).is_ok()
            })
    }

    pub fn settle(off: bool) -> bool {
        for _ in 0..16 {
            if super::disabled(&pmset(&["-g"])) != off {
                return true;
            }
            thread::sleep(Duration::from_millis(500));
        }
        false
    }

    pub fn helper(mark: &Path) -> bool {
        let pid = std::process::id().to_string();
        Command::new("/usr/bin/sudo")
            .args(["-b", "/bin/sh", "-c", HELPER, "sombre", &pid])
            .arg(mark)
            .status()
            .is_ok_and(|status| status.success())
    }

    pub fn reset() -> bool {
        Command::new("/usr/bin/sudo")
            .args(["/usr/bin/pmset", "-a", "disablesleep", "0"])
            .status()
            .is_ok_and(|status| status.success())
    }
}

#[cfg(target_os = "macos")]
pub fn awake(on: bool) {
    use std::process::{Command, Stdio};
    let Ok(mut held) = AWAKE.lock() else {
        return;
    };
    if on && held.is_none() {
        *held = Command::new("/usr/bin/caffeinate")
            .args(["-i", "-s", "-w", &std::process::id().to_string()])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .ok();
    } else if !on && let Some(mut child) = held.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg(not(target_os = "macos"))]
pub const fn awake(_: bool) {}

#[cfg(target_os = "macos")]
pub fn battery() -> Option<String> {
    reading(&mac::pmset(&["-g", "batt"]))
}

#[cfg(not(target_os = "macos"))]
pub const fn battery() -> Option<String> {
    None
}

#[cfg(target_os = "macos")]
pub fn lid(mark: &Path) -> Lid {
    match (disabled(&mac::pmset(&["-g"])), mac::alive(mark)) {
        (false, _) => Lid::Sleeps,
        (true, true) => Lid::Running,
        (true, false) => Lid::Stuck,
    }
}

#[cfg(not(target_os = "macos"))]
pub const fn lid(_: &Path) -> Lid {
    Lid::Missing
}

#[cfg(target_os = "macos")]
pub fn hold(mark: &Path) -> Result<(), String> {
    std::fs::write(mark, std::process::id().to_string())
        .map_err(|error| format!("couldn't start it: {error}"))?;
    if mac::helper(mark) && mac::settle(false) {
        return Ok(());
    }
    let _ = std::fs::remove_file(mark);
    Err("that needs your mac password, so the lid setting is unchanged".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn hold(_: &Path) -> Result<(), String> {
    Err("keeping it running with the lid closed only works on a mac for now".to_string())
}

#[cfg(target_os = "macos")]
pub fn free(mark: &Path) -> Result<(), String> {
    let managed = mac::alive(mark);
    let _ = std::fs::remove_file(mark);
    if (managed && mac::settle(true)) || (mac::reset() && mac::settle(true)) {
        return Ok(());
    }
    Err("couldn't turn lid sleep back on. run sudo pmset -a disablesleep 0".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn free(_: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spots_lid_sleep_turned_off() {
        assert!(disabled(
            " sleep 0 (sleep prevented by caffeinate)\n SleepDisabled\t\t1\n womp 1"
        ));
        assert!(!disabled(
            " sleep 0 (sleep prevented by caffeinate)\n womp 1"
        ));
        assert!(!disabled(" SleepDisabled\t\t0"));
    }

    #[test]
    fn reads_power_from_pmset() {
        assert_eq!(
            reading(
                "Now drawing from 'AC Power'\n -InternalBattery-0 (id=35520611)\t100%; charged; 0:00 remaining present: true"
            ),
            Some("plugged in, 100%".to_string())
        );
        assert_eq!(
            reading(
                "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t84%; discharging; 5:32 remaining present: true"
            ),
            Some("on battery, 84%".to_string())
        );
        assert_eq!(
            reading("Now drawing from 'AC Power'"),
            Some("plugged in".to_string())
        );
        assert_eq!(reading(""), None);
    }
}
