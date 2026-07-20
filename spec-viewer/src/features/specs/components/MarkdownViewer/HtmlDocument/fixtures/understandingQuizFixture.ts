export const understandingQuizPlanFixture = `<!doctype html>
<html>
  <head>
    <title>Understanding Quiz Plan</title>
  </head>
  <body>
    <main>
      <h1>Understanding Quiz Plan</h1>
      <p>Answer the question to verify that the plan is easy to explain.</p>
      <section aria-labelledby="plan-question">
        <h2 id="plan-question">What should the viewer do when a quiz file is missing?</h2>
        <ol data-quiz-options>
          <li>Hide the tab</li>
          <li>Show the quiz file as Missing in the default tab order</li>
        </ol>
        <button type="button" data-quiz-answer="correct">Show answer</button>
        <button type="button" data-quiz-reorder>Reorder choices</button>
        <p data-quiz-feedback hidden>Show the quiz file as Missing in the default tab order.</p>
      </section>
    </main>
    <script>
      const button = document.querySelector('[data-quiz-answer="correct"]');
      button?.addEventListener('click', () => {
        const feedback = document.querySelector('[data-quiz-feedback]');
        if (feedback) feedback.hidden = false;
        button.disabled = true;
      });
      const reorder = document.querySelector('[data-quiz-reorder]');
      reorder?.addEventListener('click', () => {
        const options = document.querySelector('[data-quiz-options]');
        if (options?.firstElementChild) options.append(options.firstElementChild);
        reorder.disabled = true;
      });
    </script>
  </body>
</html>`;

export const understandingQuizImplFixture = `<!doctype html>
<html>
  <head>
    <title>Understanding Quiz Implementation</title>
  </head>
  <body>
    <main>
      <h1>Understanding Quiz Implementation</h1>
      <p>Use the interactive prompt to check the implementation behavior.</p>
      <section aria-labelledby="impl-question">
        <h2 id="impl-question">Which files need script execution in the preview?</h2>
        <ol>
          <li data-quiz-option="wrong">Every HTML file</li>
          <li data-quiz-option="correct">Only the two understanding quiz files</li>
        </ol>
        <button type="button" data-quiz-answer="correct">Check answer</button>
        <p data-quiz-feedback hidden>Correct: the allowlist enables scripts only for the quiz HTML files.</p>
      </section>
    </main>
    <script>
      const button = document.querySelector('[data-quiz-answer="correct"]');
      button?.addEventListener('click', () => {
        const feedback = document.querySelector('[data-quiz-feedback]');
        if (feedback) feedback.hidden = false;
        button.disabled = true;
      });
    </script>
  </body>
</html>`;
