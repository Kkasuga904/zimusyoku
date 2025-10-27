import { Link } from "react-router-dom";
import { useStrings } from "../i18n/strings";

const Home = () => {
  const strings = useStrings();

  return (
    <section className="panel home-panel">
      <h2>{strings.home.title}</h2>
      <p className="intro-text">{strings.home.intro}</p>
      <div className="home-actions">
        <Link className="primary-button" to="/upload">
          {strings.home.startUpload}
        </Link>
        <Link className="secondary-button" to="/jobs">
          {strings.home.openJobs}
        </Link>
        <a
          className="link-button"
          href="/docs/USER_GUIDE_ja.md"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${strings.home.guideLink}（新しいタブで開きます）`}
        >
          {strings.common.openGuide}
        </a>
      </div>
      <p className="guide-description">{strings.home.guideDescription}</p>
      <h3>{strings.home.stepsHeading}</h3>
      <ol className="home-steps">
        {strings.home.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
};

export default Home;

