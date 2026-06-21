"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { CompletionTypeBadge, SlotBadge } from "@/components/badges/game-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMinutes } from "@/lib/backlog/format";
import type { SteamLibraryPreview } from "@/lib/steam/library";
import type { ImportDecision, SteamImportApplyResult } from "@/lib/db/repository";

export function SteamImportPanel({ defaultDecision = "review" }: { defaultDecision?: ImportDecision }) {
  const [identifier, setIdentifier] = useState("");
  const [decision, setDecision] = useState<ImportDecision>(defaultDecision);
  const [preview, setPreview] = useState<SteamLibraryPreview | null>(null);
  const [result, setResult] = useState<SteamImportApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function previewLibrary() {
    if (!identifier.trim()) return;
    setError(null);
    setResult(null);
    const response = await fetch("/api/import/steam/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "Steam preview failed.");
      return;
    }
    setPreview(json);
  }

  async function applyImport() {
    if (!identifier.trim()) return;
    setError(null);
    const response = await fetch("/api/import/steam/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, decision }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "Steam import failed.");
      return;
    }
    setResult(json);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steam library sync</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="steam-identifier">Steam ID or profile URL</Label>
            <Input
              id="steam-identifier"
              value={identifier}
              placeholder="SteamID64, /profiles URL, /id URL, SteamID2, SteamID3, or vanity name"
              onChange={(event) => setIdentifier(event.target.value)}
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
                disabled={!identifier.trim() || pending}
                onClick={() => startTransition(previewLibrary)}
              >
                Preview
              </Button>
              <Button
                type="button"
                disabled={!identifier.trim() || !preview || pending}
                onClick={() => startTransition(applyImport)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Apply sync
              </Button>
            </div>
          </div>
          {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div> : null}
          {result ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Synced {result.rowCount} Steam games: {result.addedCount} added, {result.updatedCount} updated,{" "}
              {result.missingCount} missing, {result.queuedCount} queued, {result.skippedCount} skipped,{" "}
              {result.metadataEnrichedCount} enriched, {result.metadataFailedCount} metadata misses.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview: {preview.account.displayName ?? preview.account.steamid64}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-6">
              <PreviewStat label="Rows" value={preview.rowCount} />
              <PreviewStat label="Valid" value={preview.validCount} />
              <PreviewStat label="Skipped" value={preview.skippedCount} />
              <PreviewStat label="Enriched" value={preview.metadataEnrichedCount} />
              <PreviewStat label="Metadata misses" value={preview.metadataFailedCount} />
              <PreviewStat label="SteamID64" value={preview.account.steamid64} mono />
            </div>
            {preview.privateOrEmpty ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                Steam returned no library games. Apply will not mark existing games missing from this result.
              </div>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>App</TableHead>
                      <TableHead>Playtime</TableHead>
                      <TableHead>Last played</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Finish style</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        {row.valid && row.normalized ? (
                          <>
                            <TableCell>{row.normalized.title}</TableCell>
                            <TableCell>{row.normalized.steamAppId}</TableCell>
                            <TableCell>{formatMinutes(row.normalized.playtimeMinutes)}</TableCell>
                            <TableCell>{formatDate(row.normalized.lastPlayed)}</TableCell>
                            <TableCell>
                              <SlotBadge slot={row.normalized.backlogSlot} />
                            </TableCell>
                            <TableCell>
                              <CompletionTypeBadge completionType={row.normalized.completionType} />
                            </TableCell>
                          </>
                        ) : (
                          <TableCell colSpan={6} className="text-amber-300">
                            Skipped: {row.reason}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {preview.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No preview rows returned.
                        </TableCell>
                      </TableRow>
                    ) : null}
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

function PreviewStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: number | string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`truncate text-xl font-semibold ${mono ? "font-mono text-sm leading-7" : "font-mono"}`}>
        {value}
      </div>
    </div>
  );
}
