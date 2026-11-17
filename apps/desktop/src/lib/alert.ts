import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export const notify = async (title: string, body: string) => {
  let allowed = await isPermissionGranted();
  if (!allowed) {
    allowed = (await requestPermission()) === "granted";
  }
  if (allowed) {
    sendNotification({ body, title });
  }
};

export const badge = async (count: number) => {
  await getCurrentWindow().setBadgeCount(count > 0 ? count : undefined);
};
