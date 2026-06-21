"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { AutoSaveResult } from "@/lib/backlog/autosave";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSaveField<TValue, TResult>({
  initialValue,
  save,
  debounceMs = 700,
  serialize = String,
  validate,
  onSaved,
}: {
  initialValue: TValue;
  save: (value: TValue) => Promise<AutoSaveResult<TResult>>;
  debounceMs?: number;
  serialize?: (value: TValue) => string;
  validate?: (value: TValue) => string | null;
  onSaved?: (result: TResult, savedValue: TValue) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const lastSavedRef = useRef(initialValue);
  const valueRef = useRef(initialValue);
  const saveRequestRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearPending, [clearPending]);

  const saveNow = useCallback(
    async (nextValue: TValue) => {
      clearPending();
      valueRef.current = nextValue;
      setValue(nextValue);

      if (serialize(nextValue) === serialize(lastSavedRef.current)) {
        setStatus("idle");
        setMessage(null);
        return;
      }

      const validationMessage = validate?.(nextValue);
      if (validationMessage) {
        setStatus("error");
        setMessage(validationMessage);
        toast.error(validationMessage);
        return;
      }

      const requestId = saveRequestRef.current + 1;
      saveRequestRef.current = requestId;
      setStatus("saving");
      setMessage(null);

      const result = await save(nextValue);
      if (requestId !== saveRequestRef.current) return;

      if (result.ok) {
        lastSavedRef.current = nextValue;
        setStatus("saved");
        setMessage(null);
        onSaved?.(result.value, nextValue);
        return;
      }

      setValue(lastSavedRef.current);
      valueRef.current = lastSavedRef.current;
      setStatus("error");
      setMessage(result.message);
      toast.error(result.message);
    },
    [clearPending, onSaved, save, serialize, validate],
  );

  const setAndSave = useCallback(
    (nextValue: TValue) => {
      void saveNow(nextValue);
    },
    [saveNow],
  );

  const setAndScheduleSave = useCallback(
    (nextValue: TValue) => {
      clearPending();
      valueRef.current = nextValue;
      setValue(nextValue);
      timeoutRef.current = setTimeout(() => {
        void saveNow(nextValue);
      }, debounceMs);
    },
    [clearPending, debounceMs, saveNow],
  );

  const flush = useCallback(() => {
    void saveNow(valueRef.current);
  }, [saveNow]);

  return {
    value,
    status,
    message,
    setValue,
    setAndSave,
    setAndScheduleSave,
    flush,
  };
}
