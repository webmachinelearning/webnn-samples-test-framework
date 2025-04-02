# WebNN Samples Test Framework

An automation test framework for testing [W3C WebNN Samples](https://github.com/webmachinelearning/webnn-samples) and [Microsoft WebNN Demos](https://microsoft.github.io/webnn-developer-preview/).

## Precondition

Install GPU and NPU drivers, prepare test enviroment with DirectML.dll of target version (such as 1.15.2).

```sh
copy DirectML.dll "%LOCALAPPDATA%\Google\Chrome SxS\Application\130.0.6715.0\"
```

Please refer to [WebNN Installation Guides](https://github.com/webmachinelearning/webnn-samples#webnn-installation-guides) for more details.

## Set env.json

- `env`: `'debug'` for local development. `'production'` for production model and the test result will be sent via email.
- `hostname`: Identify yourself.
- `proxy`: Set the proxy server, which is usually needed.
- `emailService`: Edit the email config according to your server.

## Set config.json

The config.json file can be dynamically generated using the command:

```shell
npm run generate-config
```

This command accepts two arguments: `--browser` and `--devices`. These arguments allow you to specify the browser and devices for which you want to generate the configuration file.

For example:

```shell
$ npm run generate-config -- --browser=chrome_canary --devices=gpu npu

> sample-test@1.0.0 generate-config
> node generate-config.js --browser=chrome_canary --devices=gpu npu

./config.json of chrome_canary on gpu-npu has been generated.
```

If you run `npm run generate-config` without passing arguments, the default configuration will be generated for `chrome_canary` and all devices(`cpu,gpu,npu`).

You can also manually adjust the parameters in config.json to fit your specific needs.

- `browser`: Choose browser to run test. "chrome_canary", "chrome_beta", "chrome_dev", "chrome_stable" or your local chrome browser executable path e.g. "C:\\\\workspace\\\\chrome.exe"
- `browserArgsWebnnNpu`: "--use-redist-dml" argument is optional, it's only required when testing by chrome browsers.
- `browserUserData`: Browser user data includes browser cache and latest DML(Edge Canary only). When webnn flag is enabled and browserUserData is used, script won't test wasm or webgl backends.
- `browserUserDataPath`: The browser `User Data` folder path supports manual setting by users and is empty by default.
- `browserAppPath`: The browser `Application` folder path supports manual setting by users and is empty by default.
- `headless`: Display chrome UI.
- `timeout`: Browser page waiting time (ms), if the test device performance is poor, please set a larger value.
- `imageCompareThreshold`: Images matching threshold, ranges from 0 to 1. Smaller values make the comparison more sensitive. 0.1 by default.
- `samplesBasicUrl`: URL of WebNN samples.
- `samplesUrl`: Each sample URL: `samplesBasicUrl + samplesUrl`.
- `samples`: WebNN samples config.
- `developerPreview`: WebNN developer preview demo config.

## Support

#### Dependency

Node

> NOTE: The command `npm run [command] -- [options | args]` may not work correctly in `PowerShell` on Windows with certain Node.js versions. It has been tested successfully on Node.js `22.11.0`, but may fail on later versions until fixing [issue 7375](https://github.com/npm/cli/issues/7375). If you encounter issues, try running it in a different terminal, such as `Git Bash`.

#### Platform

Windows / Linux / MacOS

#### Browser

chrome_canary / chrome_beta / chrome_dev / chrome_stable / edge_canary

## Install

```sh
$ npm install
$ cp env.example.json env.json
```

## Start

### Test all samples

```sh
$ npm test
```

### Test a specific single sample

Get all supported samples from help message

```shell

$ npm test -- -h

  ##### WebNN Samples Test #####

  Usage:
    npm test -- [options]

  Options:
    -h, --help                    Print this message
    -f=, --filter=                Specify the specific single sample test
    --browserAppPath=             Specify browser 'Application' folder path (relative | absolute)
                                  Relative path should be based on sample test root
    --browserUserDataPath=        Specify browser 'User Data' folder path (relative | absolute)
                                  Relative path should be based on sample test root

>>> All supported samples are as followings, select one from them.

┌───────┬──────────────────────────────────────────────────────────────┐
│ index | Values                                                       |
├───────┼──────────────────────────────────────────────────────────────┤
| 0     | samples-imageClassification-cpu-fp32-mobileNetV2             |
├───────┼──────────────────────────────────────────────────────────────┤
| 1     | developerPreview-imageClassification-gpu-fp16-mobileNetV2    |
└───────┴──────────────────────────────────────────────────────────────┘

```

Specify the sample with `-f,--filter` option

```shell
$ npm test -- -f=samples-imageClassification-cpu-fp32-mobileNetV2
```
