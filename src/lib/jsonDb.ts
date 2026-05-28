import * as fs from 'fs';
import * as path from 'path';

// Type definitions
export interface Registration {
    id: number;
    fullName: string;
    churchName: string;
    serviceRole: string;
    phoneNumber: string;
    email?: string;
    receiptPath: string;
    amount: string;
    paymentStatus: 'pending' | 'approved' | 'rejected' | 'PAY_SUCCESS';
    createdAt: string;
    isGroup?: boolean;
    checkedIn?: boolean;
    checkedInAt?: string;
    couponCode?: string;
    discountApplied?: string;
    activities?: Record<string, string>;
    attendees?: {
        fullName: string;
        role: string;
        amount: string;
        phoneNumber?: string;
        checkedIn?: boolean;
        checkedInAt?: string;
        activities?: Record<string, string>;
    }[];
}

export interface RegistrationInput {
    fullName?: string;
    churchName?: string;
    serviceRole?: string;
    phoneNumber?: string;
    email?: string;
    receiptPath?: string;
    amount?: string;
    paymentStatus?: 'pending' | 'approved' | 'rejected';
    isGroup?: boolean;
    checkedIn?: boolean;
    checkedInAt?: string;
    couponCode?: string;
    discountApplied?: string;
    activities?: Record<string, string>;
    attendees?: {
        fullName: string;
        role: string;
        amount: string;
        phoneNumber?: string;
        checkedIn?: boolean;
        checkedInAt?: string;
        activities?: Record<string, string>;
    }[];
}

export interface Database {
    registrations: Registration[];
    nextId: number;
}

export type ErrorCallback = (error: Error | null) => void;
export type InsertCallback = (error: Error | null, id?: number) => void;
export type FindAllCallback = (error: Error | null, registrations?: Registration[]) => void;
export type FindByIdCallback = (error: Error | null, registration?: Registration) => void;

// Path to the JSON database file
const DATA_DIR: string = path.resolve(process.cwd(), 'data');
const DB_PATH: string = path.join(DATA_DIR, 'registrations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database file if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ registrations: [], nextId: 1 }, null, 2));
}

/**
 * Read the database file
 */
function readDatabase(): Database {
    try {
        const data: string = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data) as Database;
    } catch (error) {
        console.error('Error reading database:', error);
        return { registrations: [], nextId: 1 };
    }
}

/**
 * Write to the database file (atomic write)
 */
function writeDatabase(data: Database): boolean {
    try {
        const tempPath: string = DB_PATH + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
        fs.renameSync(tempPath, DB_PATH);
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

/**
 * Insert a new registration
 */
export function insert(data: RegistrationInput, callback: InsertCallback): void {
    try {
        const db: Database = readDatabase();

        // Create new registration with auto-increment ID
        const newRegistration: Registration = {
            id: db.nextId,
            fullName: data.fullName || '',
            churchName: data.churchName || '',
            serviceRole: data.serviceRole || '',
            phoneNumber: data.phoneNumber || '',
            email: data.email || '',
            receiptPath: data.receiptPath || '',
            amount: data.amount || '1500',
            paymentStatus: data.paymentStatus || 'pending',
            createdAt: new Date().toISOString(),
            isGroup: data.isGroup || false,
            attendees: data.attendees || [],
            couponCode: data.couponCode,
            discountApplied: data.discountApplied
        };

        db.registrations.push(newRegistration);
        db.nextId++;

        if (writeDatabase(db)) {
            callback(null, newRegistration.id);
        } else {
            callback(new Error('Failed to write to database'));
        }
    } catch (error) {
        callback(error as Error);
    }
}

/**
 * Find all registrations
 */
export function findAll(callback: FindAllCallback): void {
    try {
        const db: Database = readDatabase();
        callback(null, db.registrations);
    } catch (error) {
        callback(error as Error);
    }
}

/**
 * Find registration by ID
 */
export function findById(id: number | string, callback: FindByIdCallback): void {
    try {
        const db: Database = readDatabase();
        const registration: Registration | undefined = db.registrations.find(
            (r: Registration) => r.id === parseInt(id.toString())
        );
        callback(null, registration);
    } catch (error) {
        callback(error as Error);
    }
}

/**
 * Update registration by ID
 */
export function update(id: number | string, updates: Partial<Registration>, callback: ErrorCallback): void {
    try {
        const db: Database = readDatabase();
        const index: number = db.registrations.findIndex(
            (r: Registration) => r.id === parseInt(id.toString())
        );

        if (index === -1) {
            callback(new Error('Registration not found'));
            return;
        }

        // Update the registration
        db.registrations[index] = {
            ...db.registrations[index],
            ...updates
        };

        if (writeDatabase(db)) {
            callback(null);
        } else {
            callback(new Error('Failed to write to database'));
        }
    } catch (error) {
        callback(error as Error);
    }
}

/**
 * Delete registration by ID
 */
export function deleteById(id: number | string, callback: ErrorCallback): void {
    try {
        const db: Database = readDatabase();
        const initialLength: number = db.registrations.length;
        db.registrations = db.registrations.filter(
            (r: Registration) => r.id !== parseInt(id.toString())
        );

        if (db.registrations.length === initialLength) {
            callback(new Error('Registration not found'));
            return;
        }

        if (writeDatabase(db)) {
            callback(null);
        } else {
            callback(new Error('Failed to write to database'));
        }
    } catch (error) {
        callback(error as Error);
    }
}

// ============================================================================
// Promise-based async/await wrappers for Next.js 15+ Route Handlers
// ============================================================================

/**
 * Insert a new registration (async version)
 */
export function insertAsync(data: RegistrationInput): Promise<number> {
    return new Promise((resolve, reject) => {
        insert(data, (error, id) => {
            if (error) {
                reject(error);
            } else if (id !== undefined) {
                resolve(id);
            } else {
                reject(new Error('Insert failed without error'));
            }
        });
    });
}

/**
 * Find all registrations (async version)
 */
export function findAllAsync(): Promise<Registration[]> {
    return new Promise((resolve, reject) => {
        findAll((error, registrations) => {
            if (error) {
                reject(error);
            } else if (registrations !== undefined) {
                resolve(registrations);
            } else {
                reject(new Error('FindAll failed without error'));
            }
        });
    });
}

/**
 * Find registration by ID (async version)
 */
export function findByIdAsync(id: number | string): Promise<Registration | undefined> {
    return new Promise((resolve, reject) => {
        findById(id, (error, registration) => {
            if (error) {
                reject(error);
            } else {
                resolve(registration);
            }
        });
    });
}

/**
 * Update registration by ID (async version)
 */
export function updateAsync(id: number | string, updates: Partial<Registration>): Promise<void> {
    return new Promise((resolve, reject) => {
        update(id, updates, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Delete registration by ID (async version)
 */
export function deleteByIdAsync(id: number | string): Promise<void> {
    return new Promise((resolve, reject) => {
        deleteById(id, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}
