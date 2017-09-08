const app = getApp()
let socket_is_open = false
let fm
let that

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    msgs: [],
    users: [],
    scrollTop: 100,
    txt_val: "",
    chosed_id: ""
  },

  onLoad: function () {
    that = this
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse) {
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }
    that.runWebSocket()
  },

  runWebSocket: function () {
    that.wsConnect()
    
    wx.onSocketOpen((res) => {  // 监听WebSocket连接打开事件
      console.log('WebSocket连接已打开！')
      socket_is_open = true
      setTimeout(()=> {
        let name = that.data.userInfo.nickName
        if (name) {
          wx.sendSocketMessage({
            data: "#改名 " + name
          })
        }
      }, 2000)
    })

    
    function appendLog(type, nickname, msg) {  // 聊天室更新函数
      let item = {}
      let prefix
      if (type === 'notification') {
        prefix = "通知："  // blue
        item.style = 'notification'
      } else if (type == 'nick_update') {
        prefix = "注意："  // green
        item.style = 'nick_update'
      } else if (type == 'reward') {
        prefix = "恭喜："  // red
        item.style = "reward_congradulation"
      } else {
        prefix = nickname + "："  // black
        item.style = 'normal'
      }
      item.msg_txt = prefix + msg  // 确定在聊天室显示什么
      let msgs = that.data.msgs  // data引用
      msgs.push(item)
      let scrollTop = that.data.scrollTop
      scrollTop += 30
      that.setData({ 
        msgs: msgs,
        scrollTop: scrollTop
      })
    }

    let nickname
    
    wx.onSocketMessage((res) => {  // 监听服务器的消息事件
      let data = JSON.parse(res.data);
      if (data.type == "refresh") {
        let users = data.users
        users.unshift(that.data.users[0])
        that.setData({ users: users })
        return
      }
      nickname = data.nickname;
      appendLog(data.type, data.nickname, data.message);
      if (data.type == "notification" || data.type == "nick_update") {
        that.updateUsers(data)
      }
      console.log("ID: [%s] = %s", data.id, data.message);
    })

    wx.onSocketClose((res) => {
      appendLog("Connection closed");
      console.log('WebSocket 已关闭！')
    })

    function disconnect() {
      wx.closeSocket()
    }
  },

  updateUsers: function(data) {  // 处理在线用户上下线、改昵称更新
    let users = that.data.users

    if (data.type == "notification") {
      let msg = data.message
      let substr = msg.substring(msg.length - 3)
      if (substr === '已连接') {
        console.log('已连接treat')
        users.push({id: data.id, nickname: data.nickname, style: "" })
      } else if (substr === '已下线') {
        console.log('已下线treat')
        for (let i = 0; i < users.length; i++) {
          if (users.id == data.id) {
            users.splice(i, 1)
          }
        }
      }    
    } else {
      for (let i = 0; i < users.length; i++) {
        if (users[i].id == data.id) {
          users[i].nickname = data.nickname
        }
      }
    }
    that.setData({
      users: users
    })
  },

  wsConnect: function() {
    wx.connectSocket({  // 创建websocket连接
      url: 'ws://192.168.14.179:8181' ,
      // url: 'ws://192.168.0.101:8181',
      data: {
      },
      method: "POST",
      fail: () => {
        let item = {}
        let msgs = that.data.msgs  // data引用
        item.msg_txt = '连接失败，可能因为：1、域名未经认证；2、重复上线。---->打开右上调试窗口可以测试'
        item.style = 'fail'
        msgs.push(item)
        let scrollTop = that.data.scrollTop
        scrollTop += 30
        that.setData({
          msgs: msgs,
          scrollTop: scrollTop
        })
      }
    })
  },

  // 提交表单
  formSubmit: function (e) {
    fm = e.detail.value
    let msg = fm.msg
    // if (socket_is_open) {
      wx.sendSocketMessage({
        data: msg
      })
    // }
    that.setData({ txt_val: "" })
  },

  getUserInfo: function (e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },

  chooseUser: function(e) {
    let i = e.target.dataset.index
    let users = that.data.users
    let chosed_id
    for (let j = 0; j < users.length; j++) {
      if (i === j) {
        users[j].style = "chosed"
        chosed_id = users[j].id
      } else {
        users[j].style = ""
      }
    } 
    that.setData({ users: users, chosed_id: chosed_id })
    console.log(e.target.dataset)
  },

  rewardOne: function() {
    let msg = that.data.userInfo.nickName + "打赏了您1元钱"
    let id = that.data.chosed_id
    if (id) {
      let data = JSON.stringify({ "msg": msg, "id": id });
      wx.sendSocketMessage({
        data: data
      })
      wx.showToast({
        title: '成功',
        icon: 'success',
        duration: 1000
      })      
    }
  }, 

  refresh: function() {
    console.log('click fresh')
    let data = ""
    try {
      let users = that.data.users
      console.log(users)
      data = JSON.stringify({ 
        "order" : 'refresh', 
        "id" : users[0].id 
      })
    } catch (e) {
      console.log(e)
      return
    }
    wx.sendSocketMessage({
      data: data
    })   
  }
})
