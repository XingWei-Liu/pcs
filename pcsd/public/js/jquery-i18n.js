var languageType =navigator.browserLanguage?navigator.browserLanguage:navigator.language;
// console.log(languageType);
let lang_type = 0;
if (languageType.search("zh") != -1){
    lang_type = 0;}
else{
    lang_type = 1;}
let xz_lang = {
    'Add Existing Cluster': [
        '添加已有集群',
        'Add Existing Cluster'
    ],
    'Add Existing': [
        '添加已有集群',
        'Add Existing'
    ],
    'Cancel': [
        '取消',
        'Cancel'
    ],
    'You must select at least one ': [
        '你必须选择至少一个',
	'You must select at least one '
    ],
    ' to remove.': [
        '去删除.',
	' to remove.'
    ],
    "cluster": [
        '集群',
	'cluster'
    ],
    "Please, select exactly one cluster to destroy.": [
        '请选择至少一个集群去删除.',
	'Please, select exactly one cluster to destroy.'
    ],
    "Create cluster: Cluster name and nodes": [
        '新建集群: 集群和节点名字',
	'Create cluster: Cluster name and nodes'
    ],
    "Create cluster": [
        '新建集群',
	'Create cluster'
    ],
    "Go to advanced settings": [
        '高级设置',
        'Go to advanced settings'
    ],
    "Node ": [
    '节点',
    'Node '
    ],
    "You must select at least one resource to add to a group": [
    '你必须选择至少一个资源添加到组中',
    'You must select at least one resource to add to a group'
    ],
    "node": [
    '节点',
    'node'
    ],
    "resource": [
    '资源',
    'resource'
    ],
    "fence device": [
    '防护设备',
    'fence device'
    ],
    "ACL role": [
    '访问角色',
    'ACL role'
    ],
    "Add Node": [
    '添加节点',
    'Add Node'
    ],
    "Add Resource": [
    '添加资源',
    'Add Resource'
    ],
    "Advanced Arguments": [
    '高级参数',
    'Advanced Arguments'
    ],
    "Log In": [
    '登录',
    'Log In'
    ],
    'Authenticate': [
    '授权',
    'Authenticate'
    ],
    'Authentication of nodes': [
    '节点授权',
    'Authentication of nodes'
    ],
    "Unable to ": [
    '无法',
    'Unable to '
    ],
    "Do you want to force the operation?": [
    '您要强制执行操作吗?',
    'Do you want to force the operation?'
    ],
    "add node to cluster": [
    '添加节点到集群',
    'add node to cluster'
    ],
    'Set': [
    '设置',
    'Set'
    ],
    "Create Group": [
    '新建资源组',
    'Create Group'
    ],
    "Error creating group ": [
    '新建资源组失败',
    'Error creating group '
    ],
    "Remove Node": [
    '移除节点',
    'Remove Node'
    ],
    "Remove Node(s)": [
    '移除节点',
    'Remove Node(s)'
    ],
    "node": [
    '节点',
    'node'
    ],
    "Add Fence Device": [
    '添加防护设备',
    'Add Fence Device'
    ],
    "remove nodes from cluster": [
    '从集群移除节点',
    'remove nodes from cluster'
    ],
    "No nodes would be left in the cluster. If you intend to destroy the whole cluster, go to cluster list page, select the cluster and click 'Destroy'.": [
    "群集中将不留任何节点。 \n如果要破坏整个群集，请转到群集列表页面，\n选择群集并单击“销毁",
    "No nodes would be left in the cluster. \nIf you intend to destroy the whole cluster, \ngo to cluster list page, select the cluster and click 'Destroy'."
    ],
    "Server returned an error: ": [
    '服务器错误',
    'Server returned an error: '
    ],
    "Enable SBD": [
    '启用SBD',
    'Enable SBD'
    ],
    "Disable SBD": [
    '禁用SBD',
    'Disable SBD'
    ],
    "Close": [
    '关闭',
    'Close'
    ],
    "Loading": [
    '加载中',
    'Loading'
    ],
    "You may not leave the cluster name field blank.":[
    "请输入集群名称",
    "You may not leave the cluster name field blank."
    ],
    "At least one valid node must be entered.":[
    "请至少添加一个节点",
    "At least one valid node must be entered."
    ],
    "Please enter the name":[
    "请输入集群名称",
    "Please enter the name"
    ],
    "Please enter the type":[
    "请输入类型"
    ],
    'Advanced Arguments': [
    '高级参数',
    'Advanced Arguments'
    ],
    'Remove Cluster(s)': [
    '移除集群',
    'Remove Cluster(s)'
    ],
    'Cluster Removal': [
    '移除集群',
    'Cluster Removal'
    ],
    'Remove resource(s)': [
    '移除资源',
    'Remove resource(s)'
    ],
    'Resource Removal': [
    '资源移除',
    'Resource Removal'
    ],
    'Remove device(s)': [
    '移除设备',
    'Remove device(s)'
    ],
    'Fence Device Removal': [
    '防护设备移除',
    'Fence Device Removal'
    ],
    'Remove Role(s)': [
    '移除用户',
    'Remove Role(s)'
    ],
    'Remove ACL Role': [
    '移除访问控制用户',
    'Remove ACL Role'
    ],
    'Resource': [
    '资源',
    ' Resource'
    ],
    'Fence Device': [
    '防护设备',
    ' Fence Device'
    ],
    'Required Arguments': [
    '必填参数',
    'Required Arguments'
    ],
    'Optional_Arguments': [
    '可选参数',
    'Optional_Arguments'
    ],
    'Advanced Arguments': [
    '高级参数',
    'Advanced Arguments'
    ],
    'Deprecated Arguments': [
    '不推荐使用的参数',
    'Deprecated Arguments'
    ],
    'Enabled': [
    '启用',
    'Enabled'
    ],
    'Disabled': [
    '禁用',
    'Disabled'],
    'You may not leave the node name field blank.':[
    '请输入节点名称',
    'You may not leave the node name field blank.',
    ],
    'Unable to add node attribute':[
    '添加节点属性失败 ',
    'Unable to add node attribute '
    ],
    'Name of utilization attribute should be non-empty string.': [
    '利用率名称属性应为非空字符串。',
    'Name of utilization attribute should be non-empty string.'
    ],
    'Value of utilization attribute has to be integer.': [
    '利用率属性值必须是整数。',
    'Value of utilization attribute has to be integer.'
    ],
    'Unable to add constraint': [
    '无法添加约束{}',
    'Unable to add constraint{}'
    ],
    'Unable to add node attribute': [
    '无法添加节点属性',
    'Unable to add node attribute'
    ],
    'Error adding ACL role': [
    '添加访问角色失败',
    'Error adding ACL role'
    ],
    "Default value: ": [
    '默认值: ',
    'Default value: '
    ],
    'quorate unknown': [
    '数量未知',
    'quorate unknown'
    ],
    "doesn't have quorum": [
    '无仲裁',
    "doesn't have quorum"
    ],
    'unknown': [
    '未知',
    'unknown'
    ],
    'Add_ACL_Role': [
    '添加ACL角色',
    'Add_ACL_Role'
    ],
    'Add_Role': [
    '添加角色',
    'Add_Role'],
    'Back': [
    '返回',
    'Back'],
    'Settings': [
    '设置',
    'Settings'],
    'setup cluster': [
    '新建集群',
    'setup cluster']
};
function translate(name) {
    let content = xz_lang[name][lang_type];
    
    if (arguments.length > 1) {        // 把占位符 {} 替换成传递的参数
        for (let i = 1; i < arguments.length; i++) {
            content = content.replace('{}', arguments[i]);
        }
    }
    
    return content;
}

