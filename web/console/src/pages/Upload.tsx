import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { registerJob, type DocumentType } from "../modules/jobsApi";
import { useStrings } from "../i18n/strings";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".csv", ".xlsx", ".zip"];

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
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("invoice");
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
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
    const selected = event.target.files?.[0] ?? null;
    setStatusMessage(null);
    setError(null);
    setJobId(null);
    setPipelineStep(0);
    setFile(selected);
    event.target.value = "";
  };

  const clearSelection = () => {
    setFile(null);
    setStatusMessage(null);
    setJobId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setPipelineStep(0);
  };

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!file) {
      setError(strings.upload.noFile);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(strings.upload.tooLarge);
      return;
    }

    if (!isAllowedExtension(file.name)) {
      setError(strings.upload.unsupported);
      return;
    }

    setIsUploading(true);
    setStatusMessage(strings.upload.uploading);
    setError(null);
    setPipelineStep(1);

    try {
      const job = await registerJob(file, documentType);
      setStatusMessage(strings.upload.success(job.id));
      setJobId(job.id);
      setFile(null);
      setPipelineStep(pipelineStages.length);
    } catch (_error) {
      setError(strings.upload.failed);
      setStatusMessage(null);
      setPipelineStep(0);
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
              onChange={handleFileChange}
              disabled={isUploading}
              ref={fileInputRef}
            />
            <label htmlFor="upload-file" className="primary-button">
              {strings.upload.selectButton}
            </label>
            {file ? (
              <span className="selected-file">
                {strings.upload.selectedFile(file.name)}
              </span>
            ) : (
              <span className="selected-file">{strings.upload.noFile}</span>
            )}
          </div>
          {file && (
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
        </fieldset>
        <fieldset className="step-card">
          <legend>{strings.upload.step2}</legend>
          <p>{strings.upload.instructions}</p>
          <button
            type="submit"
            className="primary-button wide"
            disabled={!file || isUploading}
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
          {jobId && (
            <p className="helper-text">
              <Link to={`/jobs/${jobId}`}>
                {strings.upload.viewJobDetail} ({jobId})
              </Link>
            </p>
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
