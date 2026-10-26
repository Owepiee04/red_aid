import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  CachedEvent,
  CachedUserProfile,
  OfflinePatient,
  OfflinePatientReport,
  OfflineVitalSign,
} from "./types";

export const DB_NAME = "red_aid_offline";
export const DB_VERSION = 2;

export interface RedAidOfflineDB extends DBSchema {
  Patient: {
    key: string;
    value: OfflinePatient;
    indexes: {
      eventId: string;
      addedBy: string;
    };
  };
  PatientReport: {
    key: string;
    value: OfflinePatientReport;
    indexes: {
      patientId: string;
      reportedBy: string;
    };
  };
  VitalSign: {
    key: string;
    value: OfflineVitalSign;
    indexes: {
      patientReportId: string;
    };
  };
  Event: {
    key: string;
    value: CachedEvent;
  };
  UserProfile: {
    key: string;
    value: CachedUserProfile;
  };
}

let dbPromise: Promise<IDBPDatabase<RedAidOfflineDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<RedAidOfflineDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in the browser."));
  }

  if (!dbPromise) {
    dbPromise = openDB<RedAidOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("Patient")) {
          const patients = db.createObjectStore("Patient", { keyPath: "patientId" });
          patients.createIndex("eventId", "eventId");
          patients.createIndex("addedBy", "addedBy");
        }

        if (!db.objectStoreNames.contains("PatientReport")) {
          const reports = db.createObjectStore("PatientReport", { keyPath: "patientReportId" });
          reports.createIndex("patientId", "patientId");
          reports.createIndex("reportedBy", "reportedBy");
        }

        if (!db.objectStoreNames.contains("VitalSign")) {
          const vitals = db.createObjectStore("VitalSign", { keyPath: "vitalId" });
          vitals.createIndex("patientReportId", "patientReportId");
        }

        if (!db.objectStoreNames.contains("Event")) {
          db.createObjectStore("Event", { keyPath: "eventId" });
        }

        if (!db.objectStoreNames.contains("UserProfile")) {
          db.createObjectStore("UserProfile", { keyPath: "userId" });
        }
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error instanceof Error ? error : new Error("Couldn't open the offline database.");
    });
  }

  return dbPromise;
}

export function describeDbError(action: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Couldn't ${action}: ${message}`);
}

export default getDB;
