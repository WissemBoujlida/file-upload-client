"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { CloudUpload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { uploadFiles } from "@/lib/file-upload";

const Schema = z.object({
  assets: z.object({ fileId: z.string() }).array(),
});

export function FileUploadForm() {
  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      assets: [],
    },
  });

  async function onSubmit(data: z.infer<typeof Schema>) {
    console.log(data);
    await uploadFiles(files);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-6">
        <Controller
          control={form.control}
          name="assets"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>Assets</FieldLabel>
              <FileUpload
                value={files}
                onValueChange={setFiles}
                // accept="image/*"
                onFileReject={(_, message) => {
                  console.error(message);
                }}
                multiple
                disabled={false}
              >
                <FileUploadDropzone className="flex-row border-dotted">
                  <CloudUpload className="size-4" />
                  Drag and drop or
                  <FileUploadTrigger
                    render={
                      <Button variant="link" size="sm" className="p-0">
                        Browse files
                      </Button>
                    }
                  />
                </FileUploadDropzone>
                <FileUploadList>
                  {files.map((file, index) => (
                    <FileUploadItem key={index} value={file}>
                      <FileUploadItemPreview />
                      <FileUploadItemMetadata />
                      <FileUploadItemDelete
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                          >
                            <X />
                            <span className="sr-only">Delete</span>
                          </Button>
                        }
                      />
                    </FileUploadItem>
                  ))}
                </FileUploadList>
              </FileUpload>
            </Field>
          )}
        />

        <Button className="h-10" type="submit">
          Upload
        </Button>
      </div>
    </form>
  );
}
