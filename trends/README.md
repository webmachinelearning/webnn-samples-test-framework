### Set up

The web page to display the results trends of sample metrics.

1. `npm i` to install npm modules

2. `npm run dev` to start http server

   > NOTE: By default, sample test results in the `../out/{date}` directory will be copied to `./data/{hostName}/`, but only a single copy of the latest results for each day will be kept.

3. open browser and navigate to `http://localhost:8080`

### More usage scenarios

You can also choose to deploy this web application separately to another server (for example: `user@host:/path/to/target`) and accept test results from different hosts. Then select a different `host` from the options in the page to view the results.

In `production` mode, the `scpUpload` function will be executed to upload daily test results to `user@host:/path/to/target`.
