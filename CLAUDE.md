# Project Preferences

## Error Handling in Netlify Functions
Always expose the actual error message in API responses (never hide it with a generic message). Use:
```ts
body: JSON.stringify({ action: 'message', message: `Error: ${err instanceof Error ? err.message : String(err)}` }),
```
