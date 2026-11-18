import { FileUploadForm } from "@/components/file-upload-form";
export default function Home() {
  return (
    <div className="flex justify-center items-center pt-16 px-4 min-h-screen">
      <div className="flex-1 max-w-5xl">
        <FileUploadForm />
      </div>
    </div>
  );
}
