# File Upload Client
A Next.js 16 client for the [File Upload Service](https://github.com/WissemBoujlida/file-upload-service).

Key notes:
- Uploading files in parallel: max 3 to 4 concurrent file uploads
- partial failures: if file 4/5 fails, do not drop other files
- rety with exponential backoff on 5xx HTTP errors

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
