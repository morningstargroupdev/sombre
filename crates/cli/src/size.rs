use std::thread;
use std::time::Duration;

use crate::view;

pub fn watch() {
    thread::spawn(|| {
        let mut last = view::width();
        loop {
            thread::sleep(Duration::from_millis(100));
            if sombre_harness::process::gone() {
                sombre_harness::process::bail();
            }
            let now = view::width();
            if now == last {
                continue;
            }
            thread::sleep(Duration::from_millis(75));
            if view::width() != now {
                continue;
            }
            last = now;
            view::resize();
        }
    });
}
