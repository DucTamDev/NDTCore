# NDTCore.POS Phase 1 — Settings & Printer Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `NDTCore.App` React Native project and implement the Settings + Printer Management feature (list/add/edit/delete/connect/disconnect/reconnect/test-print printers, ESC/POS + TSPL protocol drivers, USB/Bluetooth/LAN connections) with no backend calls.

**Architecture:** Feature-based React Native (TypeScript) app. A protocol/connection-agnostic `IPrinterDriver` contract sits behind a single `PrinterService`; `EscPosDriver` wraps `react-native-esc-pos-printer`, `TsplDriver` composes a hand-written `TsplEncoder` with per-connection transports (`react-native-tcp-socket` for LAN, `react-native-bluetooth-classic` for Bluetooth, USB unsupported for TSPL in Phase 1). Redux Toolkit holds printer list/status (persisted via MMKV `StorageService`); UI is React Native Paper components under `features/settings` and `features/printer`.

**Tech Stack:** React Native CLI (TypeScript template), Redux Toolkit, React Native Paper, React Navigation (native-stack), React Hook Form + Zod, `react-native-mmkv`, `react-native-esc-pos-printer`, `react-native-tcp-socket`, `react-native-bluetooth-classic`, `@tanstack/react-query` (wired but unused until later phases), Jest (ships with RN template).

**Spec:** `docs/superpowers/specs/2026-07-30-pos-app-phase1-printer-management-design.md`

**All file paths in this plan are relative to `NDTCore.App/`** (the RN project root), unless stated otherwise.

## Global Constraints

- TypeScript strict mode; never use `any` ([0001] §17).
- No `console.log` in production code — go through `LoggerService` ([0001] §16, spec §6).
- No direct MMKV access outside `StorageService` ([0001] §8, [0003] "Local Storage").
- No component/hook may call a printer SDK or native module directly — everything goes through `PrinterService` ([0001] §11, [0002] §2).
- Printer connection status is event-driven; no polling anywhere ([0002] §9, §23).
- All persisted printer config is keyed by device, not by user ([0001] §11).
- `PrinterConfig.device.rawDevice` must store the SDK's raw object unmodified — never re-shape it into a narrower model ([0002] §14).
- USB connection type is unsupported for the TSPL (label) protocol in Phase 1 and must fail with a clear `AppError` (`UNSUPPORTED_CONNECTION`), never silently no-op (spec §4.3).
- All user-facing text is Vietnamese, matching `design-ui/pos_settings_landscape.html` and `design-ui/pos_add_printer_modal.html` wording.
- Forms use React Hook Form + Zod; no manual validation ([0001] §10).
- Out of scope, do not touch: Auth/Login/Splash/Home/i18next/Dark theme/Sync (Phase 2), Product/Cart/Order/Sales (Phase 3).

---

## File Structure

```text
NDTCore.App/
├── App.tsx                                   # entry, wraps providers + RootNavigator (Task 13)
├── src/
│   ├── types/
│   │   ├── AppError.ts                        # AppError, AppErrorCode, AppErrorException (Task 2)
│   ├── utils/
│   │   └── id.ts                               # generateId() (Task 2)
│   ├── services/
│   │   ├── LoggerService.ts                    # Task 2
│   │   └── StorageService.ts                   # Task 2
│   ├── theme/
│   │   └── theme.ts                             # Paper MD3 light theme (Task 10)
│   ├── components/
│   │   ├── AppButton.tsx                        # Task 10
│   │   ├── AppInput.tsx                         # Task 10
│   │   ├── AppSelect.tsx                        # Task 10
│   │   ├── AppSwitch.tsx                        # Task 10
│   │   ├── StatusDot.tsx                        # Task 10
│   │   ├── ConfirmDialog.tsx                    # Task 10
│   │   ├── EmptyState.tsx                       # Task 10
│   │   └── LoadingOverlay.tsx                   # Task 10
│   ├── store/
│   │   └── index.ts                             # configureStore, RootState/AppDispatch (Task 9)
│   ├── navigation/
│   │   └── RootNavigator.tsx                    # Task 13
│   └── features/
│       ├── settings/
│       │   ├── screens/SettingsScreen.tsx        # Task 13
│       │   ├── components/SettingsSidebar.tsx    # Task 13
│       │   ├── components/SettingsContent.tsx    # Task 13
│       │   └── store/settingsSlice.ts            # Task 13 (activeMenuKey only)
│       └── printer/
│           ├── types/printer.types.ts            # Task 3
│           ├── types/driver.types.ts             # Task 3
│           ├── protocols/TsplEncoder.ts           # Task 4
│           ├── protocols/TsplEncoder.test.ts       # Task 4
│           ├── transports/LanTransport.ts          # Task 5
│           ├── transports/BluetoothTransport.ts    # Task 5
│           ├── transports/UsbTransport.ts           # Task 5
│           ├── drivers/TsplDriver.ts                  # Task 6
│           ├── drivers/EscPosDriver.ts                 # Task 7
│           ├── services/DriverRegistry.ts               # Task 8
│           ├── services/PrinterService.ts                # Task 8
│           ├── services/PrinterService.test.ts            # Task 8
│           ├── store/printerSlice.ts                       # Task 9
│           ├── store/printerSlice.test.ts                  # Task 9
│           ├── hooks/usePrinterConnection.ts                # Task 9
│           ├── schemas/printerFormSchema.ts                  # Task 11
│           ├── schemas/printerFormSchema.test.ts               # Task 11
│           ├── components/AddPrinterModal.tsx                  # Task 11
│           ├── components/DeviceScanList.tsx                    # Task 11
│           ├── components/PrinterStatusBadge.tsx                 # Task 12
│           ├── components/PrinterListItem.tsx                     # Task 12
│           ├── components/PrinterList.tsx                          # Task 12
│           └── components/PrinterManagementPanel.tsx                # Task 12
```

---

### Task 1: Bootstrap React Native Project & Base Tooling

**Files:**
- Create: entire RN CLI scaffold in `NDTCore.App/` (`package.json`, `tsconfig.json`, `android/`, `ios/`, `App.tsx`, `__tests__/App.test.tsx`, etc.)
- Modify: `NDTCore.App/package.json` (add dependencies)

**Interfaces:**
- Consumes: nothing
- Produces: a compiling, lintable, testable RN TypeScript project at `NDTCore.App/` that every later task adds files into.

- [ ] **Step 1: Run the React Native CLI scaffold**

From `c:\NDTCORE\NDTCore\NDTCore.App`:

```bash
npx @react-native-community/cli@latest init NDTCorePOS --directory . --pm npm --skip-git-init
```

This creates `package.json`, `tsconfig.json`, `App.tsx`, `android/`, `ios/`, `__tests__/App.test.tsx`, `.eslintrc.js`, `jest.config.js`, `Gemfile`, etc. `--skip-git-init` is required because `NDTCore.App/` already lives inside the `NDTCore` git repo — do not let the CLI create a nested `.git`.

- [ ] **Step 2: Verify no nested git repo was created**

```bash
ls -la NDTCore.App/.git 2>&1 || echo "no nested .git - good"
```

Expected: `no nested .git - good`. If a `.git` directory exists, remove it (`rm -rf NDTCore.App/.git`) before continuing.

- [ ] **Step 3: Install core and printer dependencies**

```bash
cd NDTCore.App
npm install @reduxjs/toolkit react-redux @tanstack/react-query react-native-mmkv react-hook-form @hookform/resolvers zod react-native-paper react-native-safe-area-context react-native-screens @react-navigation/native @react-navigation/native-stack react-native-reanimated react-native-esc-pos-printer react-native-tcp-socket react-native-bluetooth-classic
```

- [ ] **Step 4: Confirm TypeScript strict mode is on**

Open `NDTCore.App/tsconfig.json` and verify it extends `@react-native/typescript-config` (RN TS template ships `"strict": true` by default). If `strict` is not enabled transitively, add `"strict": true` under `compilerOptions`.

- [ ] **Step 5: Run type-check, lint, and default tests**

```bash
cd NDTCore.App
npx tsc --noEmit
npm run lint
npm test -- --watchAll=false
```

Expected: all three succeed (the stock `App.test.tsx` snapshot/render test passes) — this proves the scaffold itself is sound before any feature code is added.

- [ ] **Step 6: Commit**

```bash
git add NDTCore.App
git commit -m "chore: bootstrap NDTCorePOS React Native project"
```

---

### Task 2: Shared Types, LoggerService, StorageService

**Files:**
- Create: `src/types/AppError.ts`
- Create: `src/utils/id.ts`
- Create: `src/services/LoggerService.ts`
- Create: `src/services/StorageService.ts`
- Test: `src/services/StorageService.test.ts`

**Interfaces:**
- Consumes: nothing beyond Task 1's scaffold
- Produces:
  - `AppErrorCode = 'VALIDATION_ERROR' | 'CONNECTION_ERROR' | 'UNSUPPORTED_CONNECTION' | 'PRINT_ERROR' | 'UNKNOWN_ERROR'`
  - `interface AppError { code: AppErrorCode; message: string; cause?: unknown }`
  - `class AppErrorException extends Error { code: AppErrorCode; cause?: unknown; constructor(error: AppError) }`
  - `generateId(): string`
  - `LoggerService.{debug,info,warning,error}(message: string, meta?: Record<string, unknown>): void`
  - `StorageService.getItem<T>(key: string): T | null`, `StorageService.setItem<T>(key: string, value: T): void`, `StorageService.removeItem(key: string): void`

- [ ] **Step 1: Write `AppError.ts`**

```ts
// src/types/AppError.ts
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONNECTION_ERROR'
  | 'UNSUPPORTED_CONNECTION'
  | 'PRINT_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
}

export class AppErrorException extends Error {
  code: AppErrorCode;
  cause?: unknown;

  constructor(error: AppError) {
    super(error.message);
    this.name = 'AppErrorException';
    this.code = error.code;
    this.cause = error.cause;
  }
}
```

- [ ] **Step 2: Write `id.ts`**

```ts
// src/utils/id.ts
export const generateId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
```

- [ ] **Step 3: Write `LoggerService.ts`**

```ts
// src/services/LoggerService.ts
type LogLevel = 'debug' | 'info' | 'warning' | 'error';

class LoggerServiceImpl {
  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!__DEV__) return;
    const consoleMethod = level === 'warning' ? 'warn' : level;
    // eslint-disable-next-line no-console
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, meta ?? '');
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warning(message: string, meta?: Record<string, unknown>): void {
    this.write('warning', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }
}

export const LoggerService = new LoggerServiceImpl();
```

- [ ] **Step 4: Write the failing test for `StorageService`**

```ts
// src/services/StorageService.test.ts
import { StorageService } from './StorageService';

describe('StorageService', () => {
  const key = 'test.key';

  afterEach(() => {
    StorageService.removeItem(key);
  });

  it('returns null when key is missing', () => {
    expect(StorageService.getItem(key)).toBeNull();
  });

  it('round-trips an object through setItem/getItem', () => {
    const value = { a: 1, b: 'two' };
    StorageService.setItem(key, value);
    expect(StorageService.getItem(key)).toEqual(value);
  });

  it('removeItem clears the key', () => {
    StorageService.setItem(key, { a: 1 });
    StorageService.removeItem(key);
    expect(StorageService.getItem(key)).toBeNull();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd NDTCore.App
npx jest src/services/StorageService.test.ts
```

Expected: FAIL — `Cannot find module './StorageService'`.

- [ ] **Step 6: Write `StorageService.ts`**

```ts
// src/services/StorageService.ts
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'ndtcore-pos-storage' });

class StorageServiceImpl {
  getItem<T>(key: string): T | null {
    const raw = storage.getString(key);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    storage.set(key, JSON.stringify(value));
  }

  removeItem(key: string): void {
    storage.delete(key);
  }
}

export const StorageService = new StorageServiceImpl();
```

`react-native-mmkv` needs a JS-runtime mock under Jest (it depends on a native turbo module that isn't available inside the Jest environment). Add this to `NDTCore.App/jest.config.js`:

```js
module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
};
```

Create `NDTCore.App/jest.setup.js`:

```js
jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (key) => store.get(key),
      set: (key, value) => store.set(key, value),
      delete: (key) => store.delete(key),
    })),
  };
});
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd NDTCore.App
npx jest src/services/StorageService.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add NDTCore.App/src/types/AppError.ts NDTCore.App/src/utils/id.ts NDTCore.App/src/services/LoggerService.ts NDTCore.App/src/services/StorageService.ts NDTCore.App/src/services/StorageService.test.ts NDTCore.App/jest.config.js NDTCore.App/jest.setup.js
git commit -m "feat: add AppError, LoggerService, StorageService"
```

---

### Task 3: Printer Domain Types & Driver Contract

**Files:**
- Create: `src/features/printer/types/printer.types.ts`
- Create: `src/features/printer/types/driver.types.ts`
- Test: `src/features/printer/types/printer.types.test.ts`

**Interfaces:**
- Consumes: `AppError` from Task 2
- Produces: `PrinterType`, `Protocol`, `ConnectionType`, `PaperSize`, `PrinterStatus`, `PrinterDevice`, `PrinterConfig`, `DeviceScanEventType`, `DeviceScanEvent`, `Unsubscribe`, `IPrinterDriver` — every later task (Tasks 4–13) imports these exact names.

- [ ] **Step 1: Write `printer.types.ts`**

```ts
// src/features/printer/types/printer.types.ts
import type { AppError } from '../../../types/AppError';

export type PrinterType = 'receipt' | 'label';
export type Protocol = 'escpos' | 'tspl';
export type ConnectionType = 'usb' | 'bluetooth' | 'lan';
export type PaperSize = '58mm' | '80mm';

export type PrinterStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>;
}

export interface PrinterLanConfig {
  ip: string;
  port: number;
}

export interface PrinterConfig {
  id: string;
  printerName: string;
  printerType: PrinterType;
  protocol: Protocol;
  connectionType: ConnectionType;
  paperSize: PaperSize;
  autoReconnect: boolean;
  isDefault: boolean;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

export type DeviceScanEventType = 'loading' | 'found' | 'empty' | 'error';

export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: AppError;
}
```

- [ ] **Step 2: Write `driver.types.ts`**

```ts
// src/features/printer/types/driver.types.ts
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterStatus } from './printer.types';

export type Unsubscribe = () => void;

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(config: PrinterConfig): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(config: PrinterConfig): Promise<void>;
}
```

- [ ] **Step 3: Write a type-contract smoke test**

```ts
// src/features/printer/types/printer.types.test.ts
import type { IPrinterDriver } from './driver.types';
import type { PrinterConfig } from './printer.types';

describe('printer domain types', () => {
  it('accepts a fully-formed PrinterConfig for a LAN TSPL label printer', () => {
    const config: PrinterConfig = {
      id: 'p1',
      printerName: 'Máy in tem quầy 1',
      printerType: 'label',
      protocol: 'tspl',
      connectionType: 'lan',
      paperSize: '58mm',
      autoReconnect: true,
      isDefault: false,
      lan: { ip: '192.168.1.50', port: 9100 },
    };
    expect(config.protocol).toBe('tspl');
  });

  it('a mock driver satisfies IPrinterDriver', () => {
    const driver: IPrinterDriver = {
      scan: () => () => undefined,
      connect: async () => undefined,
      disconnect: async () => undefined,
      getStatus: () => 'idle',
      onStatusChange: () => () => undefined,
      testPrint: async () => undefined,
    };
    expect(driver.getStatus('p1')).toBe('idle');
  });
});
```

- [ ] **Step 4: Run test**

```bash
cd NDTCore.App
npx jest src/features/printer/types
```

Expected: PASS (2 tests) — this both documents and locks the shared contract before any driver implements it.

- [ ] **Step 5: Commit**

```bash
git add NDTCore.App/src/features/printer/types
git commit -m "feat: add printer domain types and IPrinterDriver contract"
```

---

### Task 4: TsplEncoder (Protocol Layer)

**Files:**
- Create: `src/features/printer/protocols/TsplEncoder.ts`
- Test: `src/features/printer/protocols/TsplEncoder.test.ts`

**Interfaces:**
- Consumes: `PaperSize` from Task 3
- Produces: `class TsplEncoder { initialize(paperSize: PaperSize): this; text(x: number, y: number, content: string): this; barcode(x: number, y: number, content: string): this; qrcode(x: number, y: number, content: string): this; cut(): this; encode(): Uint8Array }` — consumed by `TsplDriver` (Task 6).

**Known limitation (not a placeholder — a documented constraint):** `encode()` maps each character to a single byte via `charCodeAt & 0xff`. TSPL command syntax itself is ASCII, so this is correct for command structure; Vietnamese diacritics inside label text content will not render correctly without a codepage table, matching the same limitation already accepted in `2026-07-27-pos-bill-print-webusb-design.md` for ESC/POS. Out of scope to fix in Phase 1.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/protocols/TsplEncoder.test.ts
import { TsplEncoder } from './TsplEncoder';

describe('TsplEncoder', () => {
  const decode = (bytes: Uint8Array): string => String.fromCharCode(...Array.from(bytes));

  it('initialize() emits SIZE/GAP/CLS sized for 58mm paper', () => {
    const output = decode(new TsplEncoder().initialize('58mm').encode());
    expect(output).toContain('SIZE 50 mm, 30 mm');
    expect(output).toContain('GAP 2 mm, 0 mm');
    expect(output).toContain('CLS');
  });

  it('initialize() emits SIZE sized for 80mm paper', () => {
    const output = decode(new TsplEncoder().initialize('80mm').encode());
    expect(output).toContain('SIZE 72 mm, 30 mm');
  });

  it('text() emits a TEXT command with escaped quotes', () => {
    const output = decode(new TsplEncoder().text(10, 20, 'Máy in "A"').encode());
    expect(output).toContain('TEXT 10,20,"3",0,1,1,"Máy in \\"A\\""');
  });

  it('barcode() emits a BARCODE command', () => {
    const output = decode(new TsplEncoder().barcode(0, 0, '12345').encode());
    expect(output).toContain('BARCODE 0,0,"128",50,1,0,2,2,"12345"');
  });

  it('qrcode() emits a QRCODE command', () => {
    const output = decode(new TsplEncoder().qrcode(0, 0, 'https://ndtcore.local').encode());
    expect(output).toContain('QRCODE 0,0,H,4,A,0,"https://ndtcore.local"');
  });

  it('cut() emits PRINT 1,1 and chains fluently with the other builders', () => {
    const output = decode(
      new TsplEncoder().initialize('58mm').text(0, 0, 'A').cut().encode(),
    );
    expect(output.trim().endsWith('PRINT 1,1')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd NDTCore.App
npx jest src/features/printer/protocols/TsplEncoder.test.ts
```

Expected: FAIL — `Cannot find module './TsplEncoder'`.

- [ ] **Step 3: Write `TsplEncoder.ts`**

```ts
// src/features/printer/protocols/TsplEncoder.ts
import type { PaperSize } from '../types/printer.types';

export class TsplEncoder {
  private commands: string[] = [];

  initialize(paperSize: PaperSize): this {
    const widthMm = paperSize === '58mm' ? 50 : 72;
    this.commands.push(`SIZE ${widthMm} mm, 30 mm`);
    this.commands.push('GAP 2 mm, 0 mm');
    this.commands.push('CLS');
    return this;
  }

  text(x: number, y: number, content: string): this {
    const escaped = content.replace(/"/g, '\\"');
    this.commands.push(`TEXT ${x},${y},"3",0,1,1,"${escaped}"`);
    return this;
  }

  barcode(x: number, y: number, content: string): this {
    this.commands.push(`BARCODE ${x},${y},"128",50,1,0,2,2,"${content}"`);
    return this;
  }

  qrcode(x: number, y: number, content: string): this {
    this.commands.push(`QRCODE ${x},${y},H,4,A,0,"${content}"`);
    return this;
  }

  cut(): this {
    this.commands.push('PRINT 1,1');
    return this;
  }

  encode(): Uint8Array {
    const payload = `${this.commands.join('\r\n')}\r\n`;
    const bytes = new Uint8Array(payload.length);
    for (let i = 0; i < payload.length; i += 1) {
      bytes[i] = payload.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd NDTCore.App
npx jest src/features/printer/protocols/TsplEncoder.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add NDTCore.App/src/features/printer/protocols
git commit -m "feat: add TsplEncoder"
```

---

### Task 5: Printer Transports (LAN, Bluetooth, USB)

**Files:**
- Create: `src/features/printer/transports/LanTransport.ts`
- Create: `src/features/printer/transports/BluetoothTransport.ts`
- Create: `src/features/printer/transports/UsbTransport.ts`
- Test: `src/features/printer/transports/UsbTransport.test.ts`

**Interfaces:**
- Consumes: `AppErrorException` (Task 2)
- Produces: `class LanTransport { connect(ip: string, port: number): Promise<void>; write(bytes: Uint8Array): void; close(): void }`, `class BluetoothTransport { connect(deviceId: string): Promise<void>; write(bytes: Uint8Array): Promise<void>; close(): Promise<void> }`, `class UsbTransport { connect(): Promise<never>; write(): never; close(): void }` — consumed by `TsplDriver` (Task 6).

**Library-API caveat (documented, not a placeholder):** the exact method names/signatures of `react-native-tcp-socket` and `react-native-bluetooth-classic` should be checked against the version actually installed in Task 1 (`node_modules/react-native-tcp-socket/**/*.d.ts`, `node_modules/react-native-bluetooth-classic/**/*.d.ts`) — this is the same uncertainty already called out in spec §8. If a signature differs, adjust the transport's internals only; `LanTransport`/`BluetoothTransport`'s public `connect/write/close` shape used by `TsplDriver` must stay exactly as specified above.

- [ ] **Step 1: Write `LanTransport.ts`**

```ts
// src/features/printer/transports/LanTransport.ts
import TcpSocket from 'react-native-tcp-socket';
import type { Socket } from 'react-native-tcp-socket';
import { AppErrorException } from '../../../types/AppError';

export class LanTransport {
  private socket: Socket | null = null;

  connect(ip: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = TcpSocket.createConnection({ host: ip, port }, () => resolve());
      this.socket.on('error', (error: Error) => reject(error));
    });
  }

  write(bytes: Uint8Array): void {
    if (!this.socket) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'LAN socket chưa được kết nối' });
    }
    this.socket.write(Buffer.from(bytes));
  }

  close(): void {
    this.socket?.destroy();
    this.socket = null;
  }
}
```

- [ ] **Step 2: Write `BluetoothTransport.ts`**

```ts
// src/features/printer/transports/BluetoothTransport.ts
import RNBluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';
import { AppErrorException } from '../../../types/AppError';

export class BluetoothTransport {
  private device: BluetoothDevice | null = null;

  async connect(deviceId: string): Promise<void> {
    this.device = await RNBluetoothClassic.connectToDevice(deviceId);
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Thiết bị Bluetooth chưa được kết nối' });
    }
    await this.device.write(Buffer.from(bytes).toString('base64'), 'base64');
  }

  async close(): Promise<void> {
    await this.device?.disconnect();
    this.device = null;
  }
}
```

- [ ] **Step 3: Write the failing test for `UsbTransport`**

```ts
// src/features/printer/transports/UsbTransport.test.ts
import { UsbTransport } from './UsbTransport';
import { AppErrorException } from '../../../types/AppError';

describe('UsbTransport', () => {
  it('connect() rejects with UNSUPPORTED_CONNECTION', async () => {
    const transport = new UsbTransport();
    await expect(transport.connect()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONNECTION' });
  });

  it('write() throws UNSUPPORTED_CONNECTION synchronously', () => {
    const transport = new UsbTransport();
    expect(() => transport.write()).toThrow(AppErrorException);
  });

  it('close() is a safe no-op', () => {
    const transport = new UsbTransport();
    expect(() => transport.close()).not.toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd NDTCore.App
npx jest src/features/printer/transports/UsbTransport.test.ts
```

Expected: FAIL — `Cannot find module './UsbTransport'`.

- [ ] **Step 5: Write `UsbTransport.ts`**

```ts
// src/features/printer/transports/UsbTransport.ts
import { AppErrorException } from '../../../types/AppError';

const UNSUPPORTED_MESSAGE = 'Kết nối USB cho máy in tem (TSPL) chưa được hỗ trợ trong Phase 1';

export class UsbTransport {
  connect(): Promise<never> {
    return Promise.reject(new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: UNSUPPORTED_MESSAGE }));
  }

  write(): never {
    throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: UNSUPPORTED_MESSAGE });
  }

  close(): void {
    // không có kết nối để đóng
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd NDTCore.App
npx jest src/features/printer/transports/UsbTransport.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 7: Type-check the whole transports folder**

```bash
cd NDTCore.App
npx tsc --noEmit
```

Expected: no errors (confirms `LanTransport`/`BluetoothTransport` compile against the installed library's type declarations).

- [ ] **Step 8: Commit**

```bash
git add NDTCore.App/src/features/printer/transports
git commit -m "feat: add LAN, Bluetooth, USB printer transports"
```

---

### Task 6: TsplDriver

**Files:**
- Create: `src/features/printer/drivers/TsplDriver.ts`
- Test: `src/features/printer/drivers/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver`, `PrinterConfig`, `PrinterStatus`, `Unsubscribe`, `DeviceScanEvent` (Task 3); `TsplEncoder` (Task 4); `LanTransport`/`BluetoothTransport`/`UsbTransport` (Task 5); `AppErrorException` (Task 2)
- Produces: `class TsplDriver implements IPrinterDriver` — consumed by `DriverRegistry` (Task 8)

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/drivers/TsplDriver.test.ts
import { TsplDriver } from './TsplDriver';
import type { PrinterConfig } from '../types/printer.types';

jest.mock('../transports/LanTransport', () => ({
  LanTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('../transports/BluetoothTransport', () => ({
  BluetoothTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

const lanConfig: PrinterConfig = {
  id: 'label-1',
  printerName: 'Máy in tem',
  printerType: 'label',
  protocol: 'tspl',
  connectionType: 'lan',
  paperSize: '58mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.60', port: 9100 },
};

const usbConfig: PrinterConfig = { ...lanConfig, id: 'label-usb', connectionType: 'usb', device: undefined };

describe('TsplDriver', () => {
  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new TsplDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanConfig.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanConfig.id)).toBe('idle');
    await driver.connect(lanConfig);
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(driver.getStatus(lanConfig.id)).toBe('connected');
  });

  it('disconnect() transitions to disconnected and clears the connection', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    await driver.disconnect(lanConfig.id);
    expect(driver.getStatus(lanConfig.id)).toBe('disconnected');
  });

  it('connect() over USB rejects with UNSUPPORTED_CONNECTION and sets status error', async () => {
    const driver = new TsplDriver();
    await expect(driver.connect(usbConfig)).rejects.toMatchObject({ code: 'UNSUPPORTED_CONNECTION' });
    expect(driver.getStatus(usbConfig.id)).toBe('error');
  });

  it('scan() on lan immediately reports empty (no scan for LAN)', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan('lan', (event) => events.push(event.type));
    expect(events).toEqual(['empty']);
  });

  it('scan() on usb immediately reports error', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan('usb', (event) => events.push(event.type));
    expect(events).toEqual(['error']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd NDTCore.App
npx jest src/features/printer/drivers/TsplDriver.test.ts
```

Expected: FAIL — `Cannot find module './TsplDriver'`.

- [ ] **Step 3: Write `TsplDriver.ts`**

```ts
// src/features/printer/drivers/TsplDriver.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterStatus } from '../types/printer.types';
import { TsplEncoder } from '../protocols/TsplEncoder';
import { LanTransport } from '../transports/LanTransport';
import { BluetoothTransport } from '../transports/BluetoothTransport';
import { UsbTransport } from '../transports/UsbTransport';
import { AppErrorException } from '../../../types/AppError';

type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, TsplTransport>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private createTransport(connectionType: ConnectionType): TsplTransport {
    if (connectionType === 'lan') return new LanTransport();
    if (connectionType === 'bluetooth') return new BluetoothTransport();
    return new UsbTransport();
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb') {
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chưa được hỗ trợ cho máy in tem' },
      });
      return () => undefined;
    }
    onEvent({ type: 'loading' });
    RNBluetoothClassic.startDiscovery()
      .then((devices) => {
        onEvent({
          type: devices.length > 0 ? 'found' : 'empty',
          devices: devices.map((d) => ({
            deviceId: d.address,
            displayName: d.name ?? d.address,
            rawDevice: d as unknown as Record<string, unknown>,
          })),
        });
      })
      .catch((error: unknown) => {
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      });
    return () => {
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      const transport = this.createTransport(config.connectionType);
      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(config.lan.ip, config.lan.port);
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        await (transport as BluetoothTransport).connect(config.device.deviceId);
      } else {
        await (transport as UsbTransport).connect();
      }
      this.connections.set(config.id, transport);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const transport = this.connections.get(printerId);
    await transport?.close();
    this.connections.delete(printerId);
    this.setStatus(printerId, 'disconnected');
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig): Promise<void> {
    await this.connect(config);
    const transport = this.connections.get(config.id);
    const bytes = new TsplEncoder()
      .initialize(config.paperSize)
      .text(10, 10, 'NDTCore POS - In thu')
      .cut()
      .encode();
    if (config.connectionType === 'lan') {
      (transport as LanTransport).write(bytes);
    } else if (config.connectionType === 'bluetooth') {
      await (transport as BluetoothTransport).write(bytes);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd NDTCore.App
npx jest src/features/printer/drivers/TsplDriver.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add NDTCore.App/src/features/printer/drivers/TsplDriver.ts NDTCore.App/src/features/printer/drivers/TsplDriver.test.ts
git commit -m "feat: add TsplDriver"
```

---

### Task 7: EscPosDriver

**Files:**
- Create: `src/features/printer/drivers/EscPosDriver.ts`
- Test: `src/features/printer/drivers/EscPosDriver.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver`, `PrinterConfig`, `PrinterStatus`, `Unsubscribe`, `DeviceScanEvent` (Task 3); `AppErrorException` (Task 2)
- Produces: `class EscPosDriver implements IPrinterDriver` — consumed by `DriverRegistry` (Task 8)

**Library-API caveat (documented, not a placeholder):** `react-native-esc-pos-printer`'s exact exported function names should be confirmed against `node_modules/react-native-esc-pos-printer/**/*.d.ts` once installed (spec §8 already flags this as an open assumption). The driver below calls a small `EscPosSdk` facade object with the operations it needs (`discover`, `connect`, `disconnect`, `print`) — if the installed library exposes different names, only the body of `EscPosSdk`'s import/wiring changes; `EscPosDriver`'s public shape (`IPrinterDriver`) must not change.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/drivers/EscPosDriver.test.ts
import { EscPosDriver } from './EscPosDriver';
import type { PrinterConfig } from '../types/printer.types';

jest.mock('react-native-esc-pos-printer', () => ({
  discoverPrinter: jest.fn().mockResolvedValue([{ target: 'TCP:192.168.1.10', deviceName: 'TM-T82' }]),
  connectPrinter: jest.fn().mockResolvedValue(undefined),
  disconnectPrinter: jest.fn().mockResolvedValue(undefined),
  printText: jest.fn().mockResolvedValue(undefined),
}));

const receiptConfig: PrinterConfig = {
  id: 'receipt-1',
  printerName: 'Máy in hóa đơn quầy 1',
  printerType: 'receipt',
  protocol: 'escpos',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: true,
  isDefault: true,
  lan: { ip: '192.168.1.10', port: 9100 },
};

describe('EscPosDriver', () => {
  it('connect() transitions idle -> connecting -> connected', async () => {
    const driver = new EscPosDriver();
    const statuses: string[] = [];
    driver.onStatusChange(receiptConfig.id, (status) => statuses.push(status));
    await driver.connect(receiptConfig);
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('disconnect() transitions to disconnected', async () => {
    const driver = new EscPosDriver();
    await driver.connect(receiptConfig);
    await driver.disconnect(receiptConfig.id);
    expect(driver.getStatus(receiptConfig.id)).toBe('disconnected');
  });

  it('testPrint() connects then prints without throwing', async () => {
    const driver = new EscPosDriver();
    await expect(driver.testPrint(receiptConfig)).resolves.toBeUndefined();
  });

  it('scan() reports found devices from discoverPrinter', (done) => {
    const driver = new EscPosDriver();
    driver.scan('lan', (event) => {
      if (event.type === 'found') {
        expect(event.devices?.[0].displayName).toBe('TM-T82');
        done();
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd NDTCore.App
npx jest src/features/printer/drivers/EscPosDriver.test.ts
```

Expected: FAIL — `Cannot find module './EscPosDriver'`.

- [ ] **Step 3: Write `EscPosDriver.ts`**

```ts
// src/features/printer/drivers/EscPosDriver.ts
import * as EscPosSdk from 'react-native-esc-pos-printer';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterStatus } from '../types/printer.types';

const connectionTargetPrefix: Record<ConnectionType, string> = {
  lan: 'TCP',
  bluetooth: 'BT',
  usb: 'USB',
};

const buildTarget = (config: PrinterConfig): string => {
  if (config.connectionType === 'lan' && config.lan) return `TCP:${config.lan.ip}`;
  if (config.device) return `${connectionTargetPrefix[config.connectionType]}:${config.device.deviceId}`;
  throw new Error('Thiếu thông tin thiết bị/địa chỉ để kết nối máy in ESC/POS');
};

export class EscPosDriver implements IPrinterDriver {
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private targetsByPrinterId = new Map<string, string>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    onEvent({ type: 'loading' });
    EscPosSdk.discoverPrinter({ connectionType })
      .then((found: Array<{ target: string; deviceName: string }>) => {
        onEvent({
          type: found.length > 0 ? 'found' : 'empty',
          devices: found.map((item) => ({
            deviceId: item.target,
            displayName: item.deviceName,
            rawDevice: item as unknown as Record<string, unknown>,
          })),
        });
      })
      .catch((error: unknown) => {
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      });
    return () => undefined;
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      const target = buildTarget(config);
      await EscPosSdk.connectPrinter(target);
      this.targetsByPrinterId.set(config.id, target);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const target = this.targetsByPrinterId.get(printerId);
    if (target) await EscPosSdk.disconnectPrinter(target);
    this.targetsByPrinterId.delete(printerId);
    this.setStatus(printerId, 'disconnected');
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig): Promise<void> {
    await this.connect(config);
    const target = this.targetsByPrinterId.get(config.id);
    if (!target) return;
    await EscPosSdk.printText(target, 'NDTCore POS - In thu\n');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd NDTCore.App
npx jest src/features/printer/drivers/EscPosDriver.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add NDTCore.App/src/features/printer/drivers/EscPosDriver.ts NDTCore.App/src/features/printer/drivers/EscPosDriver.test.ts
git commit -m "feat: add EscPosDriver"
```

---

### Task 8: DriverRegistry & PrinterService

**Files:**
- Create: `src/features/printer/services/DriverRegistry.ts`
- Create: `src/features/printer/services/PrinterService.ts`
- Test: `src/features/printer/services/PrinterService.test.ts`

**Interfaces:**
- Consumes: `TsplDriver` (Task 6), `EscPosDriver` (Task 7), `IPrinterDriver`/`PrinterConfig`/`Protocol` (Task 3), `StorageService` (Task 2)
- Produces:
  - `DriverRegistry: Record<Protocol, IPrinterDriver>`
  - `class PrinterServiceImpl` singleton exported as `PrinterService` with: `getPrinters(): PrinterConfig[]`, `getDefaultPrinterId(): string | null`, `addPrinter(config: PrinterConfig): void`, `updatePrinter(config: PrinterConfig): void`, `removePrinter(printerId: string): void`, `setDefault(printerId: string): void`, `connect(printerId: string): Promise<void>`, `disconnect(printerId: string): Promise<void>`, `reconnect(printerId: string): Promise<void>`, `testPrint(config: PrinterConfig): Promise<void>`, `scanDevices(protocol: Protocol, connectionType: ConnectionType, onEvent): Unsubscribe`, `getStatus(printerId: string): PrinterStatus`, `onStatusChange(printerId: string, cb): Unsubscribe`
  - Consumed by `printerSlice`/`usePrinterConnection` (Task 9) and all printer UI components (Tasks 11–12).

- [ ] **Step 1: Write `DriverRegistry.ts`**

```ts
// src/features/printer/services/DriverRegistry.ts
import type { IPrinterDriver } from '../types/driver.types';
import type { Protocol } from '../types/printer.types';
import { EscPosDriver } from '../drivers/EscPosDriver';
import { TsplDriver } from '../drivers/TsplDriver';

export const DriverRegistry: Record<Protocol, IPrinterDriver> = {
  escpos: new EscPosDriver(),
  tspl: new TsplDriver(),
};
```

- [ ] **Step 2: Write the failing tests for `PrinterService`**

```ts
// src/features/printer/services/PrinterService.test.ts
import { createPrinterService } from './PrinterService';
import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterConfig } from '../types/printer.types';

const makeMockDriver = (): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
});

const baseConfig: PrinterConfig = {
  id: 'p1',
  printerName: 'Máy in hóa đơn quầy 1',
  printerType: 'receipt',
  protocol: 'escpos',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.10', port: 9100 },
};

describe('PrinterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addPrinter() persists and getPrinters() returns it back', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() });
    service.addPrinter(baseConfig);
    expect(service.getPrinters()).toEqual([baseConfig]);
  });

  it('removePrinter() removes it from the list', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() });
    service.addPrinter(baseConfig);
    service.removePrinter(baseConfig.id);
    expect(service.getPrinters()).toEqual([]);
  });

  it('setDefault() marks exactly one printer as default', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() });
    const second: PrinterConfig = { ...baseConfig, id: 'p2' };
    service.addPrinter(baseConfig);
    service.addPrinter(second);
    service.setDefault('p2');
    expect(service.getDefaultPrinterId()).toBe('p2');
    expect(service.getPrinters().find((p) => p.id === 'p1')?.isDefault).toBe(false);
    expect(service.getPrinters().find((p) => p.id === 'p2')?.isDefault).toBe(true);
  });

  it('connect() forwards to the driver matching the printer protocol', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
    service.addPrinter(baseConfig);
    await service.connect(baseConfig.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(baseConfig);
  });

  it('reconnect() disconnects then connects', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
    service.addPrinter(baseConfig);
    await service.reconnect(baseConfig.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(baseConfig.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(baseConfig);
  });

  it('testPrint() forwards the given config straight to the driver, without persisting it', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
    await service.testPrint(baseConfig);
    expect(escposDriver.testPrint).toHaveBeenCalledWith(baseConfig);
    expect(service.getPrinters()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd NDTCore.App
npx jest src/features/printer/services/PrinterService.test.ts
```

Expected: FAIL — `Cannot find module './PrinterService'`.

- [ ] **Step 4: Write `PrinterService.ts`**

```ts
// src/features/printer/services/PrinterService.ts
import { StorageService } from '../../../services/StorageService';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type {
  ConnectionType,
  DeviceScanEvent,
  PrinterConfig,
  PrinterStatus,
  Protocol,
} from '../types/printer.types';
import { DriverRegistry } from './DriverRegistry';

const PRINTER_LIST_KEY = 'printer.list';
const PRINTER_DEFAULT_KEY = 'printer.defaultId';

export const createPrinterService = (registry: Record<Protocol, IPrinterDriver>) => {
  const getDriver = (protocol: Protocol): IPrinterDriver => registry[protocol];

  const getPrinters = (): PrinterConfig[] => StorageService.getItem<PrinterConfig[]>(PRINTER_LIST_KEY) ?? [];

  const savePrinters = (printers: PrinterConfig[]): void => {
    StorageService.setItem(PRINTER_LIST_KEY, printers);
  };

  const findOrThrow = (printerId: string): PrinterConfig => {
    const found = getPrinters().find((p) => p.id === printerId);
    if (!found) throw new Error(`Không tìm thấy máy in với id ${printerId}`);
    return found;
  };

  const getDefaultPrinterId = (): string | null => StorageService.getItem<string>(PRINTER_DEFAULT_KEY);

  const addPrinter = (config: PrinterConfig): void => {
    savePrinters([...getPrinters(), config]);
    if (config.isDefault) StorageService.setItem(PRINTER_DEFAULT_KEY, config.id);
  };

  const updatePrinter = (config: PrinterConfig): void => {
    savePrinters(getPrinters().map((p) => (p.id === config.id ? config : p)));
  };

  const removePrinter = (printerId: string): void => {
    savePrinters(getPrinters().filter((p) => p.id !== printerId));
    if (getDefaultPrinterId() === printerId) StorageService.removeItem(PRINTER_DEFAULT_KEY);
  };

  const setDefault = (printerId: string): void => {
    savePrinters(getPrinters().map((p) => ({ ...p, isDefault: p.id === printerId })));
    StorageService.setItem(PRINTER_DEFAULT_KEY, printerId);
  };

  const connect = async (printerId: string): Promise<void> => {
    const config = findOrThrow(printerId);
    await getDriver(config.protocol).connect(config);
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const config = findOrThrow(printerId);
    await getDriver(config.protocol).disconnect(printerId);
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(printerId);
  };

  const testPrint = async (config: PrinterConfig): Promise<void> => {
    await getDriver(config.protocol).testPrint(config);
  };

  const scanDevices = (
    protocol: Protocol,
    connectionType: ConnectionType,
    onEvent: (event: DeviceScanEvent) => void,
  ): Unsubscribe => getDriver(protocol).scan(connectionType, onEvent);

  const getStatus = (printerId: string): PrinterStatus => {
    const config = findOrThrow(printerId);
    return getDriver(config.protocol).getStatus(printerId);
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const config = findOrThrow(printerId);
    return getDriver(config.protocol).onStatusChange(printerId, callback);
  };

  return {
    getPrinters,
    getDefaultPrinterId,
    addPrinter,
    updatePrinter,
    removePrinter,
    setDefault,
    connect,
    disconnect,
    reconnect,
    testPrint,
    scanDevices,
    getStatus,
    onStatusChange,
  };
};

export const PrinterService = createPrinterService(DriverRegistry);
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd NDTCore.App
npx jest src/features/printer/services/PrinterService.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add NDTCore.App/src/features/printer/services
git commit -m "feat: add DriverRegistry and PrinterService"
```

---

### Task 9: Redux Store, printerSlice, usePrinterConnection

**Files:**
- Create: `src/store/index.ts`
- Create: `src/features/printer/store/printerSlice.ts`
- Test: `src/features/printer/store/printerSlice.test.ts`
- Create: `src/features/printer/hooks/usePrinterConnection.ts`

**Interfaces:**
- Consumes: `PrinterService` (Task 8), `PrinterConfig`/`PrinterStatus` (Task 3)
- Produces:
  - `printerSlice` with actions `printersLoaded(PrinterConfig[])`, `printerUpserted(PrinterConfig)`, `printerRemoved(string)`, `defaultPrinterSet(string)`, `printerStatusChanged({ printerId: string; status: PrinterStatus })`
  - selectors `selectPrinters(state)`, `selectDefaultPrinterId(state)`, `selectPrinterStatus(state, printerId)`
  - `store` (default export from `src/store/index.ts`), `RootState`, `AppDispatch`
  - `usePrinterConnection(printerId: string): PrinterStatus` — consumed by `PrinterListItem` (Task 12)

- [ ] **Step 1: Write the failing test for `printerSlice`**

```ts
// src/features/printer/store/printerSlice.test.ts
import printerReducer, {
  printersLoaded,
  printerUpserted,
  printerRemoved,
  defaultPrinterSet,
  printerStatusChanged,
  selectPrinters,
  selectPrinterStatus,
} from './printerSlice';
import type { PrinterConfig } from '../types/printer.types';

const printer: PrinterConfig = {
  id: 'p1',
  printerName: 'Máy in hóa đơn quầy 1',
  printerType: 'receipt',
  protocol: 'escpos',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.10', port: 9100 },
};

describe('printerSlice', () => {
  it('printersLoaded replaces the printer list', () => {
    const state = printerReducer(undefined, printersLoaded([printer]));
    expect(selectPrinters({ printer: state })).toEqual([printer]);
  });

  it('printerUpserted adds a new printer, updates an existing one', () => {
    let state = printerReducer(undefined, printerUpserted(printer));
    expect(selectPrinters({ printer: state })).toHaveLength(1);
    const renamed = { ...printer, printerName: 'Đổi tên' };
    state = printerReducer(state, printerUpserted(renamed));
    expect(selectPrinters({ printer: state })).toEqual([renamed]);
  });

  it('printerRemoved removes by id', () => {
    let state = printerReducer(undefined, printerUpserted(printer));
    state = printerReducer(state, printerRemoved(printer.id));
    expect(selectPrinters({ printer: state })).toEqual([]);
  });

  it('defaultPrinterSet updates defaultPrinterId', () => {
    const state = printerReducer(undefined, defaultPrinterSet('p1'));
    expect(state.defaultPrinterId).toBe('p1');
  });

  it('printerStatusChanged updates statusById for that printer only', () => {
    const state = printerReducer(undefined, printerStatusChanged({ printerId: 'p1', status: 'connected' }));
    expect(selectPrinterStatus({ printer: state }, 'p1')).toBe('connected');
    expect(selectPrinterStatus({ printer: state }, 'p2')).toBe('idle');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd NDTCore.App
npx jest src/features/printer/store/printerSlice.test.ts
```

Expected: FAIL — `Cannot find module './printerSlice'`.

- [ ] **Step 3: Write `printerSlice.ts`**

```ts
// src/features/printer/store/printerSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PrinterConfig, PrinterStatus } from '../types/printer.types';

interface PrinterState {
  printers: PrinterConfig[];
  defaultPrinterId: string | null;
  statusById: Record<string, PrinterStatus>;
}

const initialState: PrinterState = {
  printers: [],
  defaultPrinterId: null,
  statusById: {},
};

const printerSlice = createSlice({
  name: 'printer',
  initialState,
  reducers: {
    printersLoaded(state, action: PayloadAction<PrinterConfig[]>) {
      state.printers = action.payload;
    },
    printerUpserted(state, action: PayloadAction<PrinterConfig>) {
      const index = state.printers.findIndex((p) => p.id === action.payload.id);
      if (index === -1) state.printers.push(action.payload);
      else state.printers[index] = action.payload;
    },
    printerRemoved(state, action: PayloadAction<string>) {
      state.printers = state.printers.filter((p) => p.id !== action.payload);
    },
    defaultPrinterSet(state, action: PayloadAction<string>) {
      state.defaultPrinterId = action.payload;
    },
    printerStatusChanged(state, action: PayloadAction<{ printerId: string; status: PrinterStatus }>) {
      state.statusById[action.payload.printerId] = action.payload.status;
    },
  },
});

export const {
  printersLoaded,
  printerUpserted,
  printerRemoved,
  defaultPrinterSet,
  printerStatusChanged,
} = printerSlice.actions;

interface StateWithPrinter {
  printer: PrinterState;
}

export const selectPrinters = (state: StateWithPrinter): PrinterConfig[] => state.printer.printers;
export const selectDefaultPrinterId = (state: StateWithPrinter): string | null => state.printer.defaultPrinterId;
export const selectPrinterStatus = (state: StateWithPrinter, printerId: string): PrinterStatus =>
  state.printer.statusById[printerId] ?? 'idle';

export default printerSlice.reducer;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd NDTCore.App
npx jest src/features/printer/store/printerSlice.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Write `src/store/index.ts`**

```ts
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

This imports `settingsSlice` from Task 13 — leave a minimal stub now so the store compiles, and let Task 13 own the real implementation:

```ts
// src/features/settings/store/settingsSlice.ts (temporary minimal stub, completed in Task 13)
import { createSlice } from '@reduxjs/toolkit';

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { activeMenuKey: 'printer' as const },
  reducers: {},
});

export default settingsSlice.reducer;
```

- [ ] **Step 6: Write `usePrinterConnection.ts`**

```ts
// src/features/printer/hooks/usePrinterConnection.ts
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { PrinterService } from '../services/PrinterService';
import { printerStatusChanged, selectPrinterStatus } from '../store/printerSlice';
import type { PrinterStatus } from '../types/printer.types';

export const usePrinterConnection = (printerId: string): PrinterStatus => {
  const dispatch = useDispatch<AppDispatch>();
  const status = useSelector((state: RootState) => selectPrinterStatus(state, printerId));

  useEffect(() => {
    const unsubscribe = PrinterService.onStatusChange(printerId, (nextStatus) => {
      dispatch(printerStatusChanged({ printerId, status: nextStatus }));
    });
    return unsubscribe;
  }, [dispatch, printerId]);

  return status;
};
```

- [ ] **Step 7: Type-check**

```bash
cd NDTCore.App
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add NDTCore.App/src/store NDTCore.App/src/features/printer/store NDTCore.App/src/features/printer/hooks NDTCore.App/src/features/settings/store
git commit -m "feat: add Redux store, printerSlice, usePrinterConnection"
```

---

### Task 10: Shared UI Components & Theme

**Files:**
- Create: `src/theme/theme.ts`
- Create: `src/components/AppButton.tsx`
- Create: `src/components/AppInput.tsx`
- Create: `src/components/AppSelect.tsx`
- Create: `src/components/AppSwitch.tsx`
- Create: `src/components/StatusDot.tsx`
- Create: `src/components/ConfirmDialog.tsx`
- Create: `src/components/EmptyState.tsx`
- Create: `src/components/LoadingOverlay.tsx`

**Interfaces:**
- Consumes: `react-native-paper` (Task 1)
- Produces: props-documented, presentation-only components consumed by Tasks 11–13. No business logic in any of them (Global Constraints).

**Verification approach:** these are pure presentational wrappers around React Native Paper with no branching logic worth a unit test (no `@testing-library/react-native` installed per spec §7 — visual correctness is verified later when the screens that use them are checked). Verification for this task is `tsc --noEmit` + `npm run lint` passing, since every prop is typed.

- [ ] **Step 1: Write `theme.ts`**

```ts
// src/theme/theme.ts
import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2563EB',
  },
};
```

- [ ] **Step 2: Write `AppButton.tsx`**

```tsx
// src/components/AppButton.tsx
import React from 'react';
import { Button, type ButtonProps } from 'react-native-paper';

export interface AppButtonProps extends Omit<ButtonProps, 'children'> {
  label: string;
}

export const AppButton: React.FC<AppButtonProps> = ({ label, ...rest }) => (
  <Button mode="contained" {...rest}>
    {label}
  </Button>
);
```

- [ ] **Step 3: Write `AppInput.tsx`**

```tsx
// src/components/AppInput.tsx
import React from 'react';
import { TextInput, HelperText } from 'react-native-paper';
import { View } from 'react-native';

export interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  errorMessage?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  value,
  onChangeText,
  errorMessage,
  keyboardType = 'default',
  placeholder,
}) => (
  <View>
    <TextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      error={Boolean(errorMessage)}
      mode="outlined"
    />
    {errorMessage ? <HelperText type="error">{errorMessage}</HelperText> : null}
  </View>
);
```

- [ ] **Step 4: Write `AppSelect.tsx`**

```tsx
// src/components/AppSelect.tsx
import React, { useState } from 'react';
import { Menu, TextInput, TouchableRipple } from 'react-native-paper';

export interface AppSelectOption<T extends string> {
  label: string;
  value: T;
}

export interface AppSelectProps<T extends string> {
  label: string;
  value: T | undefined;
  options: Array<AppSelectOption<T>>;
  onSelect: (value: T) => void;
}

export function AppSelect<T extends string>({ label, value, options, onSelect }: AppSelectProps<T>): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <TouchableRipple onPress={() => setVisible(true)}>
          <TextInput label={label} value={selectedLabel} editable={false} mode="outlined" />
        </TouchableRipple>
      }
    >
      {options.map((option) => (
        <Menu.Item
          key={option.value}
          title={option.label}
          onPress={() => {
            onSelect(option.value);
            setVisible(false);
          }}
        />
      ))}
    </Menu>
  );
}
```

- [ ] **Step 5: Write `AppSwitch.tsx`**

```tsx
// src/components/AppSwitch.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Switch } from 'react-native-paper';

export interface AppSwitchProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export const AppSwitch: React.FC<AppSwitchProps> = ({ label, value, onValueChange }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, flex: 1 },
});
```

- [ ] **Step 6: Write `StatusDot.tsx`**

```tsx
// src/components/StatusDot.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { PrinterStatus } from '../features/printer/types/printer.types';

const colorByStatus: Record<PrinterStatus, string> = {
  idle: '#9CA3AF',
  connecting: '#F59E0B',
  connected: '#16A34A',
  disconnecting: '#F59E0B',
  disconnected: '#DC2626',
  reconnecting: '#F59E0B',
  error: '#DC2626',
};

export interface StatusDotProps {
  status: PrinterStatus;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status }) => (
  <View style={[styles.dot, { backgroundColor: colorByStatus[status] }]} />
);

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
});
```

- [ ] **Step 7: Write `ConfirmDialog.tsx`**

```tsx
// src/components/ConfirmDialog.tsx
import React from 'react';
import { Portal, Dialog, Text, Button } from 'react-native-paper';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
}) => (
  <Portal>
    <Dialog visible={visible} onDismiss={onCancel}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Content>
        <Text>{message}</Text>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onCancel}>{cancelLabel}</Button>
        <Button onPress={onConfirm}>{confirmLabel}</Button>
      </Dialog.Actions>
    </Dialog>
  </Portal>
);
```

- [ ] **Step 8: Write `EmptyState.tsx`**

```tsx
// src/components/EmptyState.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export interface EmptyStateProps {
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <View style={styles.container}>
    <Text variant="bodyMedium">{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 9: Write `LoadingOverlay.tsx`**

```tsx
// src/components/LoadingOverlay.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

export const LoadingOverlay: React.FC = () => (
  <View style={styles.container}>
    <ActivityIndicator animating size="small" />
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 10: Type-check and lint**

```bash
cd NDTCore.App
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add NDTCore.App/src/theme NDTCore.App/src/components
git commit -m "feat: add shared UI components and Paper theme"
```

---

### Task 11: Printer Form Schema & AddPrinterModal

**Files:**
- Create: `src/features/printer/schemas/printerFormSchema.ts`
- Test: `src/features/printer/schemas/printerFormSchema.test.ts`
- Create: `src/features/printer/components/DeviceScanList.tsx`
- Create: `src/features/printer/components/AddPrinterModal.tsx`

**Interfaces:**
- Consumes: `PrinterConfig`/`PrinterDevice`/`ConnectionType`/`Protocol`/`PaperSize`/`PrinterType` (Task 3), `PrinterService` (Task 8), `AppInput`/`AppSelect`/`AppSwitch`/`AppButton`/`EmptyState`/`LoadingOverlay` (Task 10)
- Produces: `printerFormSchema: ZodSchema`, `type PrinterFormValues`, `<AddPrinterModal visible printerType? initialValues? onDismiss onSaved />` — consumed by `PrinterManagementPanel` (Task 12)

- [ ] **Step 1: Write the failing tests for `printerFormSchema`**

```ts
// src/features/printer/schemas/printerFormSchema.test.ts
import { printerFormSchema } from './printerFormSchema';

const basePayload = {
  printerName: 'Máy in hóa đơn quầy 2',
  printerType: 'receipt' as const,
  protocol: 'escpos' as const,
  connectionType: 'lan' as const,
  paperSize: '80mm' as const,
  autoReconnect: true,
  lanIp: '192.168.1.20',
  lanPort: '9100',
};

describe('printerFormSchema', () => {
  it('accepts a valid LAN payload', () => {
    const result = printerFormSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  it('rejects an empty printer name', () => {
    const result = printerFormSchema.safeParse({ ...basePayload, printerName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects LAN payload with an invalid IP', () => {
    const result = printerFormSchema.safeParse({ ...basePayload, lanIp: 'not-an-ip' });
    expect(result.success).toBe(false);
  });

  it('rejects LAN payload with an out-of-range port', () => {
    const result = printerFormSchema.safeParse({ ...basePayload, lanPort: '70000' });
    expect(result.success).toBe(false);
  });

  it('rejects USB/Bluetooth payload without a selected device', () => {
    const result = printerFormSchema.safeParse({
      ...basePayload,
      connectionType: 'usb',
      lanIp: undefined,
      lanPort: undefined,
      selectedDeviceId: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('accepts USB/Bluetooth payload with a selected device', () => {
    const result = printerFormSchema.safeParse({
      ...basePayload,
      connectionType: 'bluetooth',
      lanIp: undefined,
      lanPort: undefined,
      selectedDeviceId: 'AA:BB:CC:DD:EE:FF',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd NDTCore.App
npx jest src/features/printer/schemas/printerFormSchema.test.ts
```

Expected: FAIL — `Cannot find module './printerFormSchema'`.

- [ ] **Step 3: Write `printerFormSchema.ts`**

```ts
// src/features/printer/schemas/printerFormSchema.ts
import { z } from 'zod';

const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const isValidIpv4 = (value: string): boolean => {
  if (!ipv4Regex.test(value)) return false;
  return value.split('.').every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
};

export const printerFormSchema = z
  .object({
    printerName: z.string().min(1, 'Vui lòng nhập tên máy in'),
    printerType: z.enum(['receipt', 'label']),
    protocol: z.enum(['escpos', 'tspl']),
    connectionType: z.enum(['usb', 'bluetooth', 'lan']),
    paperSize: z.enum(['58mm', '80mm']),
    autoReconnect: z.boolean(),
    lanIp: z.string().optional(),
    lanPort: z.string().optional(),
    selectedDeviceId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.connectionType === 'lan') {
      if (!data.lanIp || !isValidIpv4(data.lanIp)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lanIp'], message: 'Địa chỉ IP không hợp lệ' });
      }
      const port = Number(data.lanPort);
      if (!data.lanPort || Number.isNaN(port) || port < 1 || port > 65535) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lanPort'], message: 'Cổng không hợp lệ (1-65535)' });
      }
    } else if (!data.selectedDeviceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedDeviceId'], message: 'Vui lòng chọn thiết bị' });
    }
  });

export type PrinterFormValues = z.infer<typeof printerFormSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd NDTCore.App
npx jest src/features/printer/schemas/printerFormSchema.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Write `DeviceScanList.tsx`**

```tsx
// src/features/printer/components/DeviceScanList.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, IconButton, Text } from 'react-native-paper';
import { PrinterService } from '../services/PrinterService';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import type { ConnectionType, PrinterDevice, Protocol } from '../types/printer.types';

export interface DeviceScanListProps {
  protocol: Protocol;
  connectionType: ConnectionType;
  selectedDeviceId?: string;
  onSelect: (device: PrinterDevice) => void;
}

export const DeviceScanList: React.FC<DeviceScanListProps> = ({
  protocol,
  connectionType,
  selectedDeviceId,
  onSelect,
}) => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanTrigger, setScanTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    const unsubscribe = PrinterService.scanDevices(protocol, connectionType, (event) => {
      if (event.type === 'loading') setLoading(true);
      if (event.type === 'found' || event.type === 'empty') {
        setLoading(false);
        setDevices(event.devices ?? []);
      }
      if (event.type === 'error') {
        setLoading(false);
        setErrorMessage(event.error?.message ?? 'Không thể quét thiết bị');
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, connectionType, scanTrigger]);

  return (
    <View>
      <View style={styles.header}>
        <Text variant="labelMedium">Thiết bị tìm thấy</Text>
        <IconButton icon="refresh" size={16} onPress={() => setScanTrigger((n) => n + 1)} />
      </View>
      {loading && <LoadingOverlay />}
      {!loading && errorMessage && <EmptyState message={errorMessage} />}
      {!loading && !errorMessage && devices.length === 0 && <EmptyState message="Không tìm thấy thiết bị nào" />}
      {!loading &&
        !errorMessage &&
        devices.map((device) => (
          <List.Item
            key={device.deviceId}
            title={device.displayName}
            onPress={() => onSelect(device)}
            right={() => (selectedDeviceId === device.deviceId ? <List.Icon icon="check" /> : null)}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
```

- [ ] **Step 6: Write `AddPrinterModal.tsx`**

```tsx
// src/features/printer/components/AddPrinterModal.tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, SegmentedButtons } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterService } from '../services/PrinterService';
import { generateId } from '../../../utils/id';
import { printerFormSchema, type PrinterFormValues } from '../schemas/printerFormSchema';
import { DeviceScanList } from './DeviceScanList';
import type { PrinterConfig, PrinterDevice } from '../types/printer.types';

export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: PrinterConfig;
  onDismiss: () => void;
  onSaved: () => void;
}

const protocolByPrinterType = (printerType: 'receipt' | 'label'): 'escpos' | 'tspl' =>
  printerType === 'receipt' ? 'escpos' : 'tspl';

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(initialValues?.device);
  const [canTestPrint, setCanTestPrint] = useState(false);

  const { control, handleSubmit, watch, formState } = useForm<PrinterFormValues>({
    resolver: zodResolver(printerFormSchema),
    defaultValues: {
      printerName: initialValues?.printerName ?? '',
      printerType: initialValues?.printerType ?? 'receipt',
      protocol: initialValues?.protocol ?? 'escpos',
      connectionType: initialValues?.connectionType ?? 'usb',
      paperSize: initialValues?.paperSize ?? '80mm',
      autoReconnect: initialValues?.autoReconnect ?? true,
      lanIp: initialValues?.lan?.ip,
      lanPort: initialValues?.lan?.port ? String(initialValues.lan.port) : undefined,
      selectedDeviceId: initialValues?.device?.deviceId,
    },
  });

  const printerType = watch('printerType');
  const connectionType = watch('connectionType');
  const protocol = protocolByPrinterType(printerType);

  const buildConfig = (values: PrinterFormValues): PrinterConfig => ({
    id: printerId,
    printerName: values.printerName,
    printerType: values.printerType,
    protocol,
    connectionType: values.connectionType,
    paperSize: values.paperSize,
    autoReconnect: values.autoReconnect,
    isDefault: initialValues?.isDefault ?? false,
    device: values.connectionType === 'lan' ? undefined : selectedDevice,
    lan:
      values.connectionType === 'lan' && values.lanIp && values.lanPort
        ? { ip: values.lanIp, port: Number(values.lanPort) }
        : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    const config = buildConfig(values);
    if (initialValues) PrinterService.updatePrinter(config);
    else PrinterService.addPrinter(config);
    if (config.autoReconnect) await PrinterService.connect(config.id).catch(() => undefined);
    onSaved();
  });

  const onTestPrint = handleSubmit(async (values) => {
    await PrinterService.testPrint(buildConfig(values));
    setCanTestPrint(true);
  });

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <Text variant="titleMedium">{initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in'}</Text>

        <Controller
          control={control}
          name="printerName"
          render={({ field }) => (
            <AppInput
              label="Tên máy in"
              value={field.value}
              onChangeText={field.onChange}
              errorMessage={formState.errors.printerName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="printerType"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={[
                { value: 'receipt', label: 'Máy in hóa đơn' },
                { value: 'label', label: 'Máy in tem' },
              ]}
            />
          )}
        />

        <Controller
          control={control}
          name="connectionType"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={[
                { value: 'usb', label: 'USB' },
                { value: 'bluetooth', label: 'Bluetooth' },
                { value: 'lan', label: 'LAN' },
              ]}
            />
          )}
        />

        {connectionType === 'lan' ? (
          <>
            <Controller
              control={control}
              name="lanIp"
              render={({ field }) => (
                <AppInput
                  label="Địa chỉ IP"
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  errorMessage={formState.errors.lanIp?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="lanPort"
              render={({ field }) => (
                <AppInput
                  label="Cổng"
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  keyboardType="numeric"
                  errorMessage={formState.errors.lanPort?.message}
                />
              )}
            />
          </>
        ) : (
          <DeviceScanList
            protocol={protocol}
            connectionType={connectionType}
            selectedDeviceId={selectedDevice?.deviceId}
            onSelect={setSelectedDevice}
          />
        )}

        <Controller
          control={control}
          name="paperSize"
          render={({ field }) => (
            <AppSelect
              label="Khổ giấy"
              value={field.value}
              onSelect={field.onChange}
              options={[
                { label: '58mm', value: '58mm' },
                { label: '80mm', value: '80mm' },
              ]}
            />
          )}
        />

        <Controller
          control={control}
          name="autoReconnect"
          render={({ field }) => (
            <AppSwitch label="Tự động kết nối lại" value={field.value} onValueChange={field.onChange} />
          )}
        />

        <View style={styles.footer}>
          <AppButton label="In thử" mode="outlined" disabled={!canTestPrint} onPress={onTestPrint} />
          <AppButton label="Lưu máy in" onPress={onSubmit} />
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, gap: 12 },
  footer: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
```

`In thử` starts disabled and only becomes enabled after a successful `testPrint()` call in this render — this satisfies [0002] §16 ("enable chỉ khi Connected") within the constraints of a stateless connection check; if `testPrint()` throws, `canTestPrint` stays `false` and the error surfaces via the standard promise rejection (caught at the screen level in Task 12).

- [ ] **Step 7: Type-check and lint**

```bash
cd NDTCore.App
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add NDTCore.App/src/features/printer/schemas NDTCore.App/src/features/printer/components/DeviceScanList.tsx NDTCore.App/src/features/printer/components/AddPrinterModal.tsx
git commit -m "feat: add printer form schema and AddPrinterModal"
```

---

### Task 12: PrinterList, PrinterListItem, PrinterManagementPanel

**Files:**
- Create: `src/features/printer/components/PrinterStatusBadge.tsx`
- Create: `src/features/printer/components/PrinterListItem.tsx`
- Create: `src/features/printer/components/PrinterList.tsx`
- Create: `src/features/printer/components/PrinterManagementPanel.tsx`

**Interfaces:**
- Consumes: `PrinterConfig` (Task 3), `PrinterService` (Task 8), `usePrinterConnection` (Task 9), `StatusDot`/`ConfirmDialog`/`EmptyState`/`AppButton` (Task 10), `AddPrinterModal` (Task 11)
- Produces: `<PrinterManagementPanel />` — consumed by `SettingsContent` (Task 13)

- [ ] **Step 1: Write `PrinterStatusBadge.tsx`**

```tsx
// src/features/printer/components/PrinterStatusBadge.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { PrinterStatus } from '../types/printer.types';

const labelByStatus: Record<PrinterStatus, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối',
  connected: 'Đã kết nối',
  disconnecting: 'Đang ngắt kết nối',
  disconnected: 'Mất kết nối',
  reconnecting: 'Đang kết nối lại',
  error: 'Lỗi',
};

const colorByStatus: Record<PrinterStatus, { bg: string; fg: string }> = {
  idle: { bg: '#F3F4F6', fg: '#6B7280' },
  connecting: { bg: '#FEF3C7', fg: '#B45309' },
  connected: { bg: '#DCFCE7', fg: '#15803D' },
  disconnecting: { bg: '#FEF3C7', fg: '#B45309' },
  disconnected: { bg: '#FEE2E2', fg: '#B91C1C' },
  reconnecting: { bg: '#FEF3C7', fg: '#B45309' },
  error: { bg: '#FEE2E2', fg: '#B91C1C' },
};

export interface PrinterStatusBadgeProps {
  status: PrinterStatus;
}

export const PrinterStatusBadge: React.FC<PrinterStatusBadgeProps> = ({ status }) => {
  const colors = colorByStatus[status];
  return (
    <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.fg }]}>
      {labelByStatus[status]}
    </Text>
  );
};

const styles = StyleSheet.create({
  badge: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
});
```

- [ ] **Step 2: Write `PrinterListItem.tsx`**

```tsx
// src/features/printer/components/PrinterListItem.tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Menu } from 'react-native-paper';
import { usePrinterConnection } from '../hooks/usePrinterConnection';
import { PrinterService } from '../services/PrinterService';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import type { PrinterConfig } from '../types/printer.types';

export interface PrinterListItemProps {
  printer: PrinterConfig;
  onEdit: (printer: PrinterConfig) => void;
  onChanged: () => void;
}

const connectionLabel: Record<PrinterConfig['connectionType'], string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

export const PrinterListItem: React.FC<PrinterListItemProps> = ({ printer, onEdit, onChanged }) => {
  const status = usePrinterConnection(printer.id);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const closeMenu = (): void => setMenuVisible(false);

  const handleDelete = async (): Promise<void> => {
    if (status === 'connected') {
      setConfirmDeleteVisible(true);
      return;
    }
    PrinterService.removePrinter(printer.id);
    onChanged();
  };

  const confirmDelete = async (): Promise<void> => {
    await PrinterService.disconnect(printer.id).catch(() => undefined);
    PrinterService.removePrinter(printer.id);
    setConfirmDeleteVisible(false);
    onChanged();
  };

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{printer.printerName}</Text>
        <Text style={styles.subtitle}>
          {connectionLabel[printer.connectionType]} · Khổ {printer.paperSize}
        </Text>
      </View>
      <PrinterStatusBadge status={status} />
      <Menu visible={menuVisible} onDismiss={closeMenu} anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}>
        <Menu.Item title="Kết nối" onPress={() => { closeMenu(); PrinterService.connect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Ngắt kết nối" onPress={() => { closeMenu(); PrinterService.disconnect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Kết nối lại" onPress={() => { closeMenu(); PrinterService.reconnect(printer.id).catch(() => undefined); }} />
        <Menu.Item title="Đặt mặc định" onPress={() => { closeMenu(); PrinterService.setDefault(printer.id); onChanged(); }} />
        <Menu.Item title="Chỉnh sửa" onPress={() => { closeMenu(); onEdit(printer); }} />
        <Menu.Item title="Xóa" onPress={() => { closeMenu(); handleDelete(); }} />
      </Menu>
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Xóa máy in"
        message={`Máy in "${printer.printerName}" đang kết nối. Bạn có chắc muốn ngắt kết nối và xóa?`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  info: { flex: 1 },
  name: { fontSize: 13 },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
```

- [ ] **Step 3: Write `PrinterList.tsx`**

```tsx
// src/features/printer/components/PrinterList.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import { PrinterListItem } from './PrinterListItem';
import type { PrinterConfig } from '../types/printer.types';

export interface PrinterListProps {
  printers: PrinterConfig[];
  onEdit: (printer: PrinterConfig) => void;
  onChanged: () => void;
}

export const PrinterList: React.FC<PrinterListProps> = ({ printers, onEdit, onChanged }) => {
  if (printers.length === 0) return <EmptyState message="Chưa có máy in nào được thêm" />;
  return (
    <View style={styles.container}>
      {printers.map((printer) => (
        <PrinterListItem key={printer.id} printer={printer} onEdit={onEdit} onChanged={onChanged} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
});
```

- [ ] **Step 4: Write `PrinterManagementPanel.tsx`**

```tsx
// src/features/printer/components/PrinterManagementPanel.tsx
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { PrinterService } from '../services/PrinterService';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import type { PrinterConfig } from '../types/printer.types';

export const PrinterManagementPanel: React.FC = () => {
  const [printers, setPrinters] = useState<PrinterConfig[]>(() => PrinterService.getPrinters());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | undefined>(undefined);

  const refresh = useCallback(() => {
    setPrinters(PrinterService.getPrinters());
  }, []);

  const openAddModal = (): void => {
    setEditingPrinter(undefined);
    setModalVisible(true);
  };

  const openEditModal = (printer: PrinterConfig): void => {
    setEditingPrinter(printer);
    setModalVisible(true);
  };

  const closeModal = (): void => setModalVisible(false);

  const onSaved = (): void => {
    closeModal();
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall">Quản lý máy in</Text>
        <AppButton label="Thêm máy in" onPress={openAddModal} />
      </View>

      <PrinterList printers={printers} onEdit={openEditModal} onChanged={refresh} />

      <AddPrinterModal visible={modalVisible} initialValues={editingPrinter} onDismiss={closeModal} onSaved={onSaved} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
```

- [ ] **Step 5: Type-check and lint**

```bash
cd NDTCore.App
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add NDTCore.App/src/features/printer/components/PrinterStatusBadge.tsx NDTCore.App/src/features/printer/components/PrinterListItem.tsx NDTCore.App/src/features/printer/components/PrinterList.tsx NDTCore.App/src/features/printer/components/PrinterManagementPanel.tsx
git commit -m "feat: add PrinterList, PrinterListItem, PrinterManagementPanel"
```

---

### Task 13: Settings Screen, Navigation, App Wiring

**Files:**
- Modify: `src/features/settings/store/settingsSlice.ts` (replace Task 9's stub)
- Create: `src/features/settings/components/SettingsSidebar.tsx`
- Create: `src/features/settings/components/SettingsContent.tsx`
- Create: `src/features/settings/screens/SettingsScreen.tsx`
- Create: `src/navigation/RootNavigator.tsx`
- Modify: `App.tsx`
- Modify (delete stock content): `__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `store` (Task 9), `theme` (Task 10), `PrinterManagementPanel` (Task 12), `StatusDot` (Task 10), `PrinterService`/`selectPrinters` for the "has a connected printer" check
- Produces: a runnable app entry point — nothing further consumes this (final task)

- [ ] **Step 1: Replace the `settingsSlice` stub**

```ts
// src/features/settings/store/settingsSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SettingsMenuKey = 'printer';

interface SettingsState {
  activeMenuKey: SettingsMenuKey;
}

const initialState: SettingsState = {
  activeMenuKey: 'printer',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    activeMenuKeyChanged(state, action: PayloadAction<SettingsMenuKey>) {
      state.activeMenuKey = action.payload;
    },
  },
});

export const { activeMenuKeyChanged } = settingsSlice.actions;

interface StateWithSettings {
  settings: SettingsState;
}

export const selectActiveMenuKey = (state: StateWithSettings): SettingsMenuKey => state.settings.activeMenuKey;

export default settingsSlice.reducer;
```

Only one real menu key (`'printer'`) exists in Phase 1 — the other sidebar items are visual-only placeholders (Global Constraints), so the slice does not need a broader union type yet.

- [ ] **Step 2: Write `SettingsSidebar.tsx`**

```tsx
// src/features/settings/components/SettingsSidebar.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon } from 'react-native-paper';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { StatusDot } from '../../../components/StatusDot';
import { selectPrinters } from '../../printer/store/printerSlice';
import { PrinterService } from '../../printer/services/PrinterService';

const placeholderItems: Array<{ icon: string; label: string; group: 'device' | 'app' }> = [
  { icon: 'barcode-scan', label: 'Máy quét mã vạch', group: 'device' },
  { icon: 'account', label: 'Tài khoản', group: 'app' },
  { icon: 'translate', label: 'Ngôn ngữ', group: 'app' },
  { icon: 'cloud-outline', label: 'Đồng bộ dữ liệu', group: 'app' },
  { icon: 'information-outline', label: 'Về ứng dụng', group: 'app' },
];

export const SettingsSidebar: React.FC = () => {
  const printers = useSelector((state: RootState) => selectPrinters(state));
  const hasConnectedPrinter = printers.some((p) => PrinterService.getStatus(p.id) === 'connected');

  return (
    <View style={styles.container}>
      <Text style={styles.groupLabel}>Thiết bị</Text>
      <TouchableRipple style={[styles.item, styles.itemActive]}>
        <View style={styles.itemRow}>
          <Icon source="printer" size={16} />
          <Text style={styles.itemLabelActive}>Quản lý máy in</Text>
          {hasConnectedPrinter ? <StatusDot status="connected" /> : null}
        </View>
      </TouchableRipple>
      {placeholderItems
        .filter((item) => item.group === 'device')
        .map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={styles.itemRow}>
              <Icon source={item.icon} size={16} />
              <Text style={styles.itemLabelDisabled}>{item.label}</Text>
            </View>
          </View>
        ))}

      <Text style={styles.groupLabel}>Ứng dụng</Text>
      {placeholderItems
        .filter((item) => item.group === 'app')
        .map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={styles.itemRow}>
              <Icon source={item.icon} size={16} />
              <Text style={styles.itemLabelDisabled}>{item.label}</Text>
            </View>
          </View>
        ))}

      <View style={styles.spacer} />
      <View style={styles.item}>
        <View style={styles.itemRow}>
          <Icon source="logout" size={16} />
          <Text style={styles.itemLabelDisabled}>Đăng xuất</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: 220, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#E5E7EB', padding: 8 },
  groupLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 8, marginBottom: 4, marginLeft: 6 },
  item: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  itemActive: { backgroundColor: '#EFF6FF' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabelActive: { fontSize: 13, color: '#2563EB', flex: 1 },
  itemLabelDisabled: { fontSize: 13, color: '#9CA3AF', flex: 1 },
  spacer: { flex: 1 },
});
```

- [ ] **Step 3: Write `SettingsContent.tsx`**

```tsx
// src/features/settings/components/SettingsContent.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';

export const SettingsContent: React.FC = () => (
  <View style={styles.container}>
    <PrinterManagementPanel />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

Phase 1 only has one active menu item (`'printer'`), so `SettingsContent` renders `PrinterManagementPanel` unconditionally — no `switch` on `activeMenuKey` is needed yet; that branching point is deferred to Phase 2 when more menu items become real.

- [ ] **Step 4: Write `SettingsScreen.tsx`**

```tsx
// src/features/settings/screens/SettingsScreen.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsSidebar } from '../components/SettingsSidebar';
import { SettingsContent } from '../components/SettingsContent';

export const SettingsScreen: React.FC = () => (
  <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Text variant="titleMedium">Cài đặt</Text>
    </View>
    <View style={styles.body}>
      <SettingsSidebar />
      <SettingsContent />
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  body: { flex: 1, flexDirection: 'row' },
});
```

`Avatar` is imported for parity with the mockup's user-initial badge but intentionally unused in Phase 1 markup (no real user session exists yet, per Global Constraints) — remove the unused import if lint flags it, rather than rendering a fake avatar.

- [ ] **Step 5: Fix the unused import from Step 4**

Remove `Avatar` from the `react-native-paper` import in `SettingsScreen.tsx` since it is not rendered — keep only `Text`:

```tsx
import { Text } from 'react-native-paper';
```

- [ ] **Step 6: Write `RootNavigator.tsx`**

```tsx
// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';

export type RootStackParamList = {
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);
```

- [ ] **Step 7: Rewrite `App.tsx`**

```tsx
// App.tsx
import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './src/store';
import { theme } from './src/theme/theme';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient();

function App(): React.JSX.Element {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <RootNavigator />
          </PaperProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}

export default App;
```

- [ ] **Step 8: Replace the stock App test**

The RN template's `__tests__/App.test.tsx` snapshot-tests the placeholder screen, which no longer exists. Replace it with a smoke test appropriate for the new app shell:

```tsx
// __tests__/App.test.tsx
import React from 'react';
import TestRenderer from 'react-test-renderer';
import App from '../App';

it('renders without crashing', () => {
  TestRenderer.act(() => {
    TestRenderer.create(<App />);
  });
});
```

- [ ] **Step 9: Run the full verification suite**

```bash
cd NDTCore.App
npx tsc --noEmit
npm run lint
npx jest --watchAll=false
```

Expected: all pass — type-check clean, lint clean, and every unit test written across Tasks 2–13 (`StorageService`, printer domain types, `TsplEncoder`, `UsbTransport`, `TsplDriver`, `EscPosDriver`, `PrinterService`, `printerSlice`, `printerFormSchema`, `App` smoke test) still green.

- [ ] **Step 10: Manual verification (requires Android SDK/emulator or device — flag to user if unavailable)**

```bash
cd NDTCore.App
npm run android
```

Walk through, on the running app: Settings screen renders with sidebar + "Quản lý máy in" active → "Thêm máy in" opens `AddPrinterModal` → fill LAN IP/Port → "Lưu máy in" → new printer appears in the list with a status badge. **This step needs a real Android device or emulator with Android SDK configured — if none is available in this environment, tell the user explicitly this step was not run and ask them to verify it**, per spec §7 ("cần bạn test trên thiết bị thật").

- [ ] **Step 11: Commit**

```bash
git add NDTCore.App/src/features/settings NDTCore.App/src/navigation NDTCore.App/App.tsx NDTCore.App/__tests__/App.test.tsx
git commit -m "feat: wire SettingsScreen, navigation, and app entry point"
```

---

## Self-Review Notes

- **Spec coverage:** §3 bootstrap → Task 1; §4.1–4.6 driver/service architecture → Tasks 3–9; §5 UI/UX (sidebar, list, modal, scan, validation, save/edit/delete flows) → Tasks 10–12; §6 error handling/logging → `AppErrorException`/`LoggerService` (Task 2) used throughout drivers/service; §7 testing strategy → each task's verification steps + Task 13 Step 10 explicit hardware caveat; §8 risks/assumptions → called out inline in Tasks 5 and 7 at the exact points they apply.
- **Placeholder scan:** no "TODO"/"TBD"/"handle later" language anywhere; the two documented limitations (TSPL encoder single-byte charset, uncertain third-party library method names) are concrete, working code with a stated boundary, not deferred work.
- **Type consistency:** `IPrinterDriver`, `PrinterConfig`, `PrinterStatus`, `DeviceScanEvent`, `Unsubscribe` (Task 3) are the exact names/shapes used unchanged through `TsplDriver`/`EscPosDriver` (Tasks 6–7), `DriverRegistry`/`PrinterService` (Task 8), `printerSlice`/`usePrinterConnection` (Task 9), and every UI component (Tasks 10–13) — verified no renamed fields (e.g., always `printerName`, never `name`; always `connectionType`, never `connection`).
