1. 參考 .env.example 建立 .env 檔案，並將你真實的 github personal access token，這個 token 必須擁有你的目標 repository 的 pulls read 權限。
2. 執行程式
```
node index.js {organization} {repository name}

// example
node index.js b12031106 github-pr-statistics
``` 
