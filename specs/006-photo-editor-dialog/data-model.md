# Data Model: Photo Editor Dialog

**Feature**: 006-photo-editor-dialog  
**Date**: 2026-05-26

## Persistent Entities (unchanged)

### Photo (SQLite: `photos` table)

No schema changes. The editor dialog surfaces the existing `rotation`, `flipped`, and `crop` fields already stored per photo.

| Field | Type | Notes |
|---|---|---|
| id | integer PK | — |
| shelter_id | integer FK | — |
| file_name | text | Relative path under `shelters/<slug>/photos/` |
| rotation | integer | Degrees (0, 90, 180, 270) |
| flipped | boolean | Horizontal flip flag |
| crop | JSON / null | `{x, y, width, height}` in pixels or null |
| title | text | — |
| photographer | text | — |
| date_taken | text | — |
| caption | text | — |
| alt_text | text | — |
| description | text | — |
| notes | text | — |
| include_in_post | boolean | — |
| updated | text | ISO date |

## Transient UI State (new, in-memory only)

### Editor Dialog State

Lives exclusively inside the `PhotoEditorDialog` component while the dialog is open. Discarded on Cancel or unmount. Never written to the database unless the user clicks Save.

| Field | Type | Initial value | Notes |
|---|---|---|---|
| rotation | number | 0 | Cumulative degrees added during this session |
| flipped | boolean | false | Toggle state for this session |
| cropping | boolean | false | Whether crop-draw mode is active |
| cropRect | `{x,y,w,h}` (%) | `{x:12,y:14,w:70,h:68}` | Drag handle positions as viewport percentages |
| crop | `{x,y,width,height}` px \| null | null | Confirmed crop in natural image pixels |
| zoom | number | 1 | Display-only; not saved |
| saving | boolean | false | True while IPC save call is in flight |

## Props Contract: PhotoEditorDialog

The new component accepts these props from `PhotosTab`:

| Prop | Type | Description |
|---|---|---|
| photo | `Photo` | The photo being edited |
| photoUrl | `string` | Pre-built URL for the image source |
| shelterId | `number` | For dispatching save actions |
| sheltersRoot | `string` | For IPC calls |
| isDefault | `boolean` | Whether to show the default badge |
| onSave | `() => void` | Called after a successful save (closes dialog, bumps version counter) |
| onCancel | `() => void` | Called on Cancel / Escape / overlay click |
