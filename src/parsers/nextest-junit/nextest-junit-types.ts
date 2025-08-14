export interface JunitReport {
  testsuites: TestSuites
}

export interface TestSuites {
  $: {
    name: string
    tests: string
    failures: string
    errors: string
    timestamp: string
    time: string
  }
  testsuite?: TestSuite[]
}

export interface TestSuite {
  $: {
    name: string
    tests: string
    disabled: string
    errors: string
    failures: string
  }
  testcase?: TestCase[]
}

export interface TestCase {
  $: {
    name: string
    classname: string
    timestamp: string
    time: string
  }
  failure?: TestFailure[]
}

export interface TestFailure {
  _: string
  $: {
    message: string,
    type?: string,
  }
}
