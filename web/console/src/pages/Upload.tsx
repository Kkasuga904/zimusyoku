import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { registerJob, type DocumentType } from "../modules/jobsApi";
import { UnauthorizedError } from "../modules/apiClient";
import { useStrings } from "../i18n/strings";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".csv", ".xlsx", ".zip", ".jpeg", ".jpg"];

const normalizeExtension = (fileName: string) => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) {
    return "";
  }

  return fileName.slice(lastDot).toLowerCase();
};

const isAllowedExtension = (fileName: string) =>
  ALLOWED_EXTENSIONS.includes(normalizeExtension(fileName));

const Upload = () => {
  const strings = useStrings();
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>("invoice");
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedJobIds, setUploadedJobIds] = useState<string[]>([]);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);
  const [enhance, setEnhance] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pipelineStages = useMemo(
    () => [
      strings.upload.pipeline.uploaded,
      strings.upload.pipeline.ocr,
      strings.upload.pipeline.classify,
      strings.upload.pipeline.posted,
    ],
    [strings.upload.pipeline],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }
    setStatusMessage(null);
    setError(null);
    setUploadedJobIds([]);
    setPipelineStep(0);
    setCurrentFileIndex(null);
    setFiles((previous) => [...previous, ...selectedFiles]);
    event.target.value = "";
  };

  const clearSelection = () => {
    setFiles([]);
    setStatusMessage(null);
    setUploadedJobIds([]);
    setCurrentFileIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setPipelineStep(0);
  };

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (files.length === 0) {
      setError(strings.upload.noFile);
      return;
    }

    const tooLarge = files.find((item) => item.size > MAX_FILE_SIZE);
    if (tooLarge) {
      setError(strings.upload.fileTooLarge(tooLarge.name));
      return;
    }

    const unsupported = files.find((item) => !isAllowedExtension(item.name));
    if (unsupported) {
      setError(strings.upload.fileUnsupported(unsupported.name));
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadedJobIds([]);
    setPipelineStep(1);

    if (files.length === 1) {
      setStatusMessage(strings.upload.uploading);
      setCurrentFileIndex(0);
    } else {
      setStatusMessage(strings.upload.uploadingBatch(1, files.length));
      setCurrentFileIndex(0);
    }

    const createdJobs: string[] = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        const currentFile = files[index];

        if (index > 0) {
          setPipelineStep(1);
          setCurrentFileIndex(index);
          setStatusMessage(strings.upload.uploadingBatch(index + 1, files.length));
        }

        const job = await registerJob(currentFile, documentType, { enhance });
        createdJobs.push(job.id);
        setPipelineStep(pipelineStages.length);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setFiles([]);
      setUploadedJobIds(createdJobs);
      setCurrentFileIndex(null);
      setPipelineStep(pipelineStages.length);
      setStatusMessage(
        createdJobs.length === 1
          ? strings.upload.success(createdJobs[0])
          : strings.upload.successMultiple(createdJobs.length),
      );
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setError(strings.upload.loginRequired);
      } else {
        setError(strings.upload.failed);
      }
      setStatusMessage(null);
      setPipelineStep(0);
      if (createdJobs.length > 0) {
        setUploadedJobIds(createdJobs);
      }
      setCurrentFileIndex(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="panel upload-panel">
      <h2>{strings.upload.title}</h2>
      <p>{strings.upload.description}</p>
      <form className="step-grid" onSubmit={handleSubmit}>
        <fieldset className="step-card">
          <legend>{strings.upload.step1}</legend>
          <p>{strings.upload.instructions}</p>
          <div className="file-input-group">
            <input
              id="upload-file"
              name="upload-file"
              type="file"
              className="sr-only"
              accept={ALLOWED_EXTENSIONS.join(",")}
              multiple
              onChange={handleFileChange}
              disabled={isUploading}
              ref={fileInputRef}
            />
            <label htmlFor="upload-file" className="primary-button">
              {strings.upload.selectButton}
            </label>
            {files.length > 0 ? (
              <div className="selected-file">
                <p>{strings.upload.selectedFiles(files.length)}</p>
                <ul className="selected-file-list">
                  {files.map((selectedFile, index) => (
                    <li
                      key={`${selectedFile.name}-${selectedFile.lastModified}-${index}`}
                      className={
                        isUploading && currentFileIndex === index
                          ? "selected-file-item active"
                          : "selected-file-item"
                      }
                    >
                      {selectedFile.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <span className="selected-file">{strings.upload.noFile}</span>
            )}
          </div>
          {files.length > 0 && (
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={clearSelection}
                disabled={isUploading}
              >
                {strings.upload.changeFile}
              </button>
              <button
                type="button"
                className="link-button"
                onClick={clearSelection}
                disabled={isUploading}
              >
                {strings.upload.clearSelection}
              </button>
            </div>
          )}
          <p className="helper-text">{strings.upload.helperFormats}</p>
          <label className="dropdown-label" htmlFor="document-type">
            {strings.upload.selectType}
          </label>
          <select
            id="document-type"
            name="document-type"
            className="select-field"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as DocumentType)}
            disabled={isUploading}
          >
            <option value="invoice">{strings.upload.types.invoice}</option>
            <option value="receipt">{strings.upload.types.receipt}</option>
            <option value="estimate">{strings.upload.types.estimate}</option>
          </select>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={enhance}
              onChange={(event) => setEnhance(event.target.checked)}
              disabled={isUploading}
            />
            <span>{strings.upload.enhanceLabel}</span>
          </label>
          <p className="helper-text">{strings.upload.enhanceHelp}</p>
        </fieldset>
        <fieldset className="step-card">
          <legend>{strings.upload.step2}</legend>
          <p>{strings.upload.instructions}</p>
          <button
            type="submit"
            className="primary-button wide"
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {strings.upload.uploading}
              </>
            ) : (
              strings.upload.submitButton
            )}
          </button>
          <p
            className="status-message"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={strings.upload.ariaStatus}
          >
            {statusMessage}
          </p>
          <ol className="pipeline-list" aria-live="polite">
            {pipelineStages.map((stage, index) => (
              <li
                key={stage}
                className={
                  index < pipelineStep
                    ? "pipeline-step done"
                    : index === pipelineStep
                      ? "pipeline-step active"
                      : "pipeline-step"
                }
              >
                {stage}
              </li>
            ))}
          </ol>
        </fieldset>
        <fieldset className="step-card">
          <legend>{strings.upload.step3}</legend>
          <p>{strings.upload.jobsShortcut}</p>
          <Link className="secondary-button" to="/jobs">
            {strings.upload.linkToJobs}
          </Link>
          {uploadedJobIds.length > 0 && (
            <ul className="job-link-list">
              {uploadedJobIds.map((id) => (
                <li key={id}>
                  <Link to={`/jobs/${id}`}>
                    {strings.upload.viewJobDetail} ({id})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </form>

      {error && (
        <div className="error-banner" role="alert">
          <p>{error}</p>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => handleSubmit()}
              disabled={isUploading}
            >
              {strings.upload.tryAgain}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default Upload;
