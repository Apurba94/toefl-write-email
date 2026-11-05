# Email Writing Coach

Write short emails to a professor, a landlord or a club, timed, with a checklist and model answers.

Part of the [GRE and TOEFL Study Suite](https://github.com/Apurba94/gre-toefl-study-suite): 100 free study apps for the TOEFL iBT and more. It works offline, as a Windows program or in the browser.

## Download and run

- **Windows:** download `Email Writing Coach.exe` from the [latest release](https://github.com/Apurba94/toefl-write-email/releases/latest) and open it. Nothing to install. It opens in its own window and saves your progress in your user folder.
- **Browser:** open it online in the suite's web edition at https://gre-toefl-study-suite.vercel.app/apps/toefl-write-email/ . Progress stays in that browser.
- **From source:** `python launcher.py` (Python 3.10 or later, no packages needed).

## What it does

The TOEFL Writing section includes writing a short email for a real situation, covering the points you are given. This coach has eight original situations, from asking a professor about a missed class to reporting a broken heater. It times you, checks the email's shape, and shows a model email afterwards.

Sections: Write, Progress, About.

## How to use it

1. Read the situation and the three points in **Write**. Plan one or two sentences per point.
2. Start the timer. Seven minutes is a practice default; check ets.org for the current timing.
3. Press **Get feedback**, tick the checklist, and compare with the model email.

## Good to know

- All questions, passages and definitions were written for this suite. None are official ETS questions. For official practice, use the materials on ets.org.
- It follows the GRE General Test as shortened in September 2023 and the TOEFL iBT as updated in January 2026. Formats change, so check ets.org before your test.
- Feedback on writing and speaking counts things a program can count honestly, such as length and linking words. It does not give an official score.
- Not endorsed by or affiliated with ETS. GRE and TOEFL are registered trademarks of ETS.

## For developers

The app is plain HTML and JavaScript in `web/`, run by a small Python launcher that serves it on 127.0.0.1 only and needs a secret token for saving. Tests: `node --test "tests/*.test.js"` (24 tests) and `python -m unittest discover -s tests`. Build the .exe with `python build_exe.py`.

Built with AI assistance (Claude Code). MIT licence. By JANIN A APURBA.
