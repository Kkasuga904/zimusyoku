# Console Agent Overrides

# agent:declare
version: 1
style:
  typescript:
    formatter:
      cmd: "npm run fmt:console"
    lint:
      cmd: "npm run lint:console"
qa:
  typescript:
    coverage_threshold: 0.85
