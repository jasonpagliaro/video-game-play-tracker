"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SlotBadge, CompletionTypeBadge } from "@/components/badges/game-badges";
import type { CsvPreview } from "@/lib/backlog/types";
import type { ImportDecision } from "@/lib/db/repository";

type ImportResult = {
  batchId: string | null;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  rowCount: number;
};

export function CsvImportPanel({ defaultDecision = "review" }: { defaultDecision?: ImportDecision }) {
  const [file, setFile] = useState<File | null>(null);
  const [decision, setDecision] = useState<ImportDecision>(defaultDecision);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function previewFile() {
    if (!file) return;
    setError(null);
    setResult(null);
    const data = new FormData();
    data.set("file", file);
    const response = await fetch("/api/import/preview", { method: "POST", body: data });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "Preview failed.");
      return;
    }
    setPreview(json);
  }

  async function applyImport() {
    if (!file) return;
    setError(null);
    const data = new FormData();
    data.set("file", file);
    data.set("decision", decision);
    const response = await fetch("/api/import/apply", { method: "POST", body: data });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "Import failed.");
      return;
    }
    setResult(json);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV upload</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="csv-file">Steam library CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-[240px_1fr] md:items-end">
            <div className="grid gap-2">
              <Label>New game handling</Label>
              <Select value={decision} onValueChange={(value) => setDecision(value as ImportDecision)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="review">Review manually</SelectItem>
                  <SelectItem value="unqueued">Leave unqueued</SelectItem>
                  <SelectItem value="queue">Add with balanced queue insertion</SelectItem>
                  <SelectItem value="park">Park imported games</SelectItem>
                  <SelectItem value="wont_complete">Mark Won&apos;t Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!file || pending}
                onClick={() => startTransition(previewFile)}
              >
                Preview
              </Button>
              <Button type="button" disabled={!file || !preview || pending} onClick={() => startTransition(applyImport)}>
                <Upload className="mr-2 h-4 w-4" />
                Apply import
              </Button>
            </div>
          </div>
          {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div> : null}
          {result ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Imported {result.rowCount} rows: {result.addedCount} added, {result.updatedCount} updated, {result.skippedCount} skipped.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview: {preview.filename}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <PreviewStat label="Rows" value={preview.rowCount} />
              <PreviewStat label="Valid" value={preview.validCount} />
              <PreviewStat label="Skipped" value={preview.skippedCount} />
              <PreviewStat label="Unknown columns" value={preview.unknownColumns.length} />
            </div>
            <div className="rounded-md border border-border p-3 text-xs">
              <div className="mb-2 font-medium">Column mapping</div>
              <div className="grid gap-1 md:grid-cols-3">
                {Object.entries(preview.mapping).map(([field, column]) => (
                  <div key={field} className="text-muted-foreground">
                    <span className="text-foreground">{field}</span>: {column ?? "unmapped"}
                  </div>
                ))}
              </div>
              {preview.unknownColumns.length ? (
                <div className="mt-2 text-muted-foreground">Unknown: {preview.unknownColumns.join(", ")}</div>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>App</TableHead>
                      <TableHead>Playtime</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Finish style</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        {row.valid && row.normalized ? (
                          <>
                            <TableCell>{row.normalized.title}</TableCell>
                            <TableCell>{row.normalized.steamAppId ?? "-"}</TableCell>
                            <TableCell>{Math.round(row.normalized.playtimeMinutes / 60)}h</TableCell>
                            <TableCell>
                              <SlotBadge slot={row.normalized.backlogSlot} />
                            </TableCell>
                            <TableCell>
                              <CompletionTypeBadge completionType={row.normalized.completionType} />
                            </TableCell>
                            <TableCell className="font-mono">{row.normalized.priorityScore}</TableCell>
                          </>
                        ) : (
                          <TableCell colSpan={6} className="text-amber-300">
                            Skipped: {row.reason}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-xl font-semibold">{value}</div>
    </div>
  );
}
