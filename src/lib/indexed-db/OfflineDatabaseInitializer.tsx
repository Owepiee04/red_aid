"use client";

import { useEffect } from "react";
import { getDB } from "./db";

export default function OfflineDatabaseInitializer() {
  useEffect(() => {
    void getDB().catch((error: unknown) => {
      console.error("Couldn't initialize the offline database.", error);
    });
  }, []);

  return null;
}
