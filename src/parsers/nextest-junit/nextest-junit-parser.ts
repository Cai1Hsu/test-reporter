import { ParseOptions, TestParser } from "../../test-parser";
import { parseStringPromise } from 'xml2js'

import { TestGroupResult, TestRunResult, TestSuiteResult, TestCaseResult, TestCaseError } from "../../test-results";
import { JunitReport, TestSuite, TestCase } from "./nextest-junit-types";

export class NextestJunitParser implements TestParser {
  constructor(readonly options: ParseOptions) {}

  async parse(path: string, content: string): Promise<TestRunResult> {
    const ju = await this.getJunitReport(path, content)
    return this.getTestRunResult(path, ju)
  }

  private async getJunitReport(path: string, content: string): Promise<JunitReport> {
    try {
      return (await parseStringPromise(content)) as JunitReport
    } catch (e) {
      throw new Error(`Invalid XML at ${path}\n\n${e}`)
    }
  }

  private async getTestRunResult(path: string, junit: JunitReport): Promise<TestRunResult> {
    const suites =
      junit.testsuites.testsuite === undefined
        ? []
        : junit.testsuites.testsuite.map(ts => {
          const name = ts.$.name.trim()
          const [groups, time] = this.getGroups(ts);
          return new TestSuiteResult(name, groups, time);
        });

    const time = junit.testsuites.$ && parseFloat(junit.testsuites.$.time) * 1000
    return new TestRunResult(path, suites, time)
  }

  private getGroups(ts: TestSuite): [TestGroupResult[], number] {
    const testCases = ts.testcase ? ts.testcase : [];
    const testCaseResults = testCases.map(tc => this.getTestCaseResult(tc));
    const group = new TestGroupResult('', testCaseResults);
    const time = testCaseResults.reduce((total, tc) => total + tc.time, 0);
    return [[group], time];
  }

  private getTestCaseResult(testCase: TestCase): TestCaseResult {
    const name = testCase.$.name;
    const time = parseFloat(testCase.$.time) * 1000 || 0;

    if (testCase.failure) {
      const failure = testCase.failure[0];
      let errorMessage = failure.$.message;

      // Parse path and line number from error message
      // Example: "thread 'sys_write::tests::test_bad_address_with_invalid_buffer' panicked at test-utilities\src\memory.rs:311:9"
      let path: string | undefined;
      let line: number | undefined;

      const pathLineRegex = /panicked at ([^:]+):(\d+):\d+/;
      const match = errorMessage.match(pathLineRegex);
      if (match) {
        path = match[1];
        line = parseInt(match[2], 10);
      }

      // Extract panic reason from failure._ and combine with errorMessage
      if (failure._) {
        // Try to extract panic reason from the second line of failure._
        const lines = failure._.split('\n');
        if (lines.length >= 2 && lines[1].trim() !== '') {
          errorMessage = `${errorMessage}: ${lines[1].trim()}`;
        }

        for (let i = 2; i < lines.length; i++) {
          // break untils the line is empty, starts with `stack backtrace:` or `note:`
          if (lines[i].trim() === '' || lines[i].startsWith('stack backtrace:') || lines[i].startsWith('note:')) {
            break;
          }
          errorMessage += `\n${lines[i].trim()}`;
        }
      }

      const testCaseError: TestCaseError = {
        path: path,
        line: line,
        message: errorMessage,
        details: failure._
      };

      return new TestCaseResult(
        name,
        'failed',
        time,
        testCaseError
      );
    }

    return new TestCaseResult(
      name,
      'success',
      time
    );
  }
}