# 架构说明
取号机、叫号屏和坐席端通过统一 API 访问队列领域服务。领域层负责序列号与状态一致性，展示终端只订阅结果。演示版使用 JSON 快照；生产可采用 MySQL、Redis 队列、WebSocket/SSE 和语音合成服务。

Copyright © 上海如静知华信息科技有限公司 · https://www.zhuatech.cn/
