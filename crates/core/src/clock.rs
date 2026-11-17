use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|time| time.as_nanos())
        .unwrap_or_default()
}

fn mix(mut value: u64) -> u64 {
    value = value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    value = (value ^ (value >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^ (value >> 31)
}

pub fn uuid() -> String {
    let seed = u64::try_from(nanos() % u128::from(u64::MAX)).unwrap_or_default()
        ^ (u64::from(std::process::id()) << 32)
        ^ COUNTER
            .fetch_add(1, Ordering::Relaxed)
            .wrapping_mul(0x1000_0001);
    let high = mix(seed);
    let low = mix(high ^ seed.rotate_left(17));
    let high = (high & !0xf000) | 0x4000;
    let low = (low & !(0xc000 << 48)) | (0x8000 << 48);
    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
        high >> 32,
        (high >> 16) & 0xffff,
        high & 0xffff,
        low >> 48,
        low & 0xffff_ffff_ffff
    )
}

pub fn iso(millis: u128) -> String {
    let seconds = i64::try_from(millis / 1000).unwrap_or_default();
    let rest = millis % 1000;
    let days = seconds.div_euclid(86_400);
    let clock = seconds.rem_euclid(86_400);
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day = shifted.rem_euclid(146_097);
    let year_of_era = (day - day / 1460 + day / 36_524 - day / 146_096) / 365;
    let day_of_year = day - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let date = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{date:02}T{:02}:{:02}:{:02}.{rest:03}Z",
        clock / 3600,
        (clock % 3600) / 60,
        clock % 60
    )
}

pub fn now() -> u128 {
    nanos() / 1_000_000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn makes_unique_version_four_ids() {
        let first = uuid();
        let second = uuid();
        assert_ne!(first, second);
        assert_eq!(first.len(), 36);
        assert_eq!(&first[14..15], "4");
        assert!(matches!(&first[19..20], "8" | "9" | "a" | "b"));
    }

    #[test]
    fn formats_utc_timestamps() {
        assert_eq!(iso(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso(1_794_346_265_123), "2026-11-10T21:31:05.123Z");
        assert_eq!(iso(951_782_400_000), "2000-02-29T00:00:00.000Z");
    }
}
