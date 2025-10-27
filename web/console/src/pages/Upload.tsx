import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
} from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, uploadFile } from "../lib/api";

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  const handleFile = useCallback((selected: File | null) => {
    setFile(selected);
    setError(null);
  }, []);

  const onFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files && event.target.files[0];
      handleFile(selected ?? null);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const selected = event.dataTransfer.files && event.dataTransfer.files[0];
      handleFile(selected ?? null);
    },
    [handleFile],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const triggerSelect = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!file) {
        setError("Select a file to process");
        return;
      }

      setIsUploading(true);
      try {
        const result = await uploadFile(file);
        window.alert("Created job " + result.job_id);
        navigate("/jobs/" + result.job_id);
      } catch (cause) {
        const message =
          cause instanceof ApiError ? cause.message : "Upload failed";
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [file, navigate],
  );

  const helperText = useMemo(() => {
    if (file) {
      return "Ready to upload " + file.name;
    }
    return "Choose a file or drop it here";
  }, [file]);

  return (
    <section className="panel">
      <h2>Upload</h2>
      <form className="upload-form" onSubmit={onSubmit}>
        <div
          className="drop-zone"
          onDrop={onDrop}
          onDragOver={onDragOver}
          role="presentation"
          onClick={triggerSelect}
        >
          <p>{helperText}</p>
          <p className="hint">Supported formats: any file</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          onChange={onFileChange}
          aria-label="Select file"
          className="sr-only"
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={isUploading}>
          {isUploading ? "Uploading…" : "Submit for processing"}
        </button>
      </form>
    </section>
  );
};

export default Upload;
