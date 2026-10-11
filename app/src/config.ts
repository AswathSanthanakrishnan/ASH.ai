// Physical iPhone: connect to the Mac on the same LAN at port 4000.
// iOS simulator can also reach the Mac through localhost.
// Physical devices need the Mac's LAN IP instead, e.g. http://192.168.1.10:4000.
// Android emulator: use http://10.0.2.2:4000 (or adb reverse tcp:4000 tcp:4000).
export const API_BASE_URL = 'http://192.168.1.226:4000';
