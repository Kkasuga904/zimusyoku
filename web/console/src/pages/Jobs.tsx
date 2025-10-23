import { useEffect, useState } from "react";

type JobStatus = "Open" | "Interviewing" | "Closed";

type Job = {
  id: string;
  title: string;
  status: JobStatus;
  postedAt: string;
};

const fallbackJobs: Job[] = [
  {
    id: "JOB-1001",
    title: "Accounts Specialist",
    status: "Open",
    postedAt: "2025-10-15",
  },
  {
    id: "JOB-1002",
    title: "Office Coordinator",
    status: "Interviewing",
    postedAt: "2025-10-10",
  },
  {
    id: "JOB-1003",
    title: "Document Control Clerk",
    status: "Closed",
    postedAt: "2025-09-25",
  },
];

const Jobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    // Placeholder: replace this simulated fetch with a real API call when available.
    const timer = window.setTimeout(() => {
      setJobs(fallbackJobs);
    }, 100);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="panel">
      <h2>Jobs</h2>
      <p>
        This list refreshes from static sample data. Connect it to the extractor
        or another API when backend endpoints are available.
      </p>
      <table className="job-table">
        <caption className="sr-only">Open requisitions</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Posted</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={4}>Loading current jobs…</td>
            </tr>
          ) : (
            jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.id}</td>
                <td>{job.title}</td>
                <td>
                  <span className={"badge badge-" + job.status.toLowerCase()}>
                    {job.status}
                  </span>
                </td>
                <td>{job.postedAt}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
};

export default Jobs;
