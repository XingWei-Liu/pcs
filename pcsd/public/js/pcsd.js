var pcs_timeout = 30000;
var login_dialog_opened = false;
var ajax_queue = Array();

function curResource() {
  var obj = Pcs.resourcesContainer.get('cur_resource');
  if (obj == null) {
    return null;
  }
  return obj.get('id');
}

function curStonith() {
  var obj = Pcs.resourcesContainer.get('cur_fence');
  if (obj == null) {
    return null;
  }
  return obj.get('id');
}

function configure_menu_show(item) {
  $("#configure-"+item).show();
  $(".configure-"+item).addClass("selected");
}

function menu_show(item,show) {
  if (show) {
    $("#" + item + "_menu").addClass("active");
  } else {
    $("#" + item + "_menu").removeClass("active");
  }
}

// Changes the visible change when another menu is selected
// If item is specified, we load that item as well
// If initial is set to true, we load default (first item) on other pages
// and load the default item on the specified page if item is set
function select_menu(menu, item, initial) {
  if (menu == "NODES") {
    Pcs.set('cur_page',"nodes");
    if (item)
      Pcs.nodesController.load_node($('[nodeID='+item+']'));
    menu_show("node", true);
  } else {
    menu_show("node", false);
  }

  if (menu == "RESOURCES") {
    Pcs.set('cur_page',"resources");
    menu_show("resource", true);
  } else {
    menu_show("resource", false);
  }

  if (menu == "FENCE DEVICES") {
    Pcs.set('cur_page',"stonith");
    menu_show("stonith", true);
  } else {
    menu_show("stonith", false);
  }

  if (menu == "MANAGE") {
    Pcs.set('cur_page',"manage");
    menu_show("cluster", true);
  } else {
    menu_show("cluster", false);
  }

  if (menu == "PERMISSIONS") {
    Pcs.set('cur_page', "permissions");
    menu_show("cluster", true);
  } else {
    menu_show("cluster", false);
  }

  if (menu == "CONFIGURE") {
    Pcs.set('cur_page',"configure");
    menu_show("configure", true);
  } else {
    menu_show("configure", false);
  }

  if (menu == "ACLS") {
    Pcs.set('cur_page',"acls");
    menu_show("acls", true);
  } else {
    menu_show("acls", false);
  }
}

function create_group() {
  var resource_list = get_checked_ids_from_nodelist("resource_list");
  if (resource_list.length == 0) {
    alert(translate("You must select at least one resource to add to a group"));
    return;
  }
  var not_primitives = resource_list.filter(function(resource_id) {
    var resource_obj = Pcs.resourcesContainer.get_resource_by_id(resource_id);
    return !(resource_obj && resource_obj.get("is_primitive"));
  });
  if (not_primitives.length != 0) {
    alert("Members of group have to be primitive resources. These resources" +
      " are not primitives: " + not_primitives.join(", "));
    return;
  }
  var order_el = $("#new_group_resource_list tbody");
  order_el.empty();
  order_el.append(resource_list.map(function (item) {
    return `<tr value="${item}" class="cursor-move"><td>${item}</td></tr>`;
  }));
  var order_obj = order_el.sortable();
  order_el.disableSelection();
  $("#add_group").dialog({
    title: translate('Create Group'),
    width: 'auto',
    modal: true,
    resizable: false,
    buttons: [
      {
        text: translate("Cancel"),
        click: function() {
          $(this).dialog("close");
        }
      },
      {
        text: translate("Create Group"),
        id: "add_group_submit_btn",
        click: function() {
          var dialog_obj = $(this);
          var submit_btn_obj = dialog_obj.parent().find(
            "#add_group_submit_btn"
          );
          submit_btn_obj.button("option", "disabled", true);

          ajax_wrapper({
            type: "POST",
            url: get_cluster_remote_url() + "add_group",
            data: {
              resource_group: $(
                '#add_group:visible input[name=resource_group]'
              ).val(),
              resources: order_obj.sortable(
                "toArray", {attribute: "value"}
              ).join(" ")
            },
            success: function() {
              submit_btn_obj.button("option", "disabled", false);
              Pcs.update();
              dialog_obj.dialog("close");
            },
            error: function (xhr, status, error) {
              alert(
                translate("Error creating group ")
                + ajax_simple_error(xhr, status, error)
              );
              submit_btn_obj.button("option", "disabled", false);
            }
          });
        }
      }
    ]
  });
}

function add_sbd_device_textbox() {
  var max_count = 3;
  var device_inputs = $("#add_node_selector .add_node_sbd_device");
  var count = device_inputs.length;
  if (count < max_count) {
    $(device_inputs[count-1]).after(
      '<tr class="add_node_sbd_device"> \
        <td>&nbsp;</td> \
        <td> \
          <input type="text" name="devices[]" /> \
          <a href="#" onclick="sbd_device_remove_textbox(this); return false;"> \
            (-) \
          </a> \
        </td> \
      </tr>'
    );
  }
}

function sbd_device_remove_textbox(obj) {
  $(obj).parents(".add_node_sbd_device").remove();
}

function create_resource_error_processing(error_message, form, update, stonith) {
  var message = (
    "Unable to " + (update ? "update " : "add ") + name + "\n" + error_message
  );
  if (message.indexOf('--force') == -1) {
    alert(message);
  }
  else {
    message = message.replace(', use --force to override', '');
    if (confirm(message + "\n\nDo you want to force the operation?")) {
      create_resource(form, update, stonith, true);
    }
  }
}

// If update is set to true we update the resource instead of create it
// if stonith is set to true we update/create a stonith agent
function create_resource(form, update, stonith, force) {
  var data = {};
  $($(form).serializeArray()).each(function(index, obj) {
    data[obj.name] = obj.value;
  });
  data["resource_type"] = data["resource_type"].replace("::", ":");
  var url = get_cluster_remote_url() + $(form).attr("action");
  var name;

  if (stonith) {
    name = "fence device";
    data["resource_type"] = data["resource_type"].replace("stonith:", "");
  } else {
    name = "resource";
  }
  if (force) {
    data["force"] = force;
  }

  ajax_wrapper({
    type: "POST",
    url: url,
    data: data,
    dataType: "json",
    success: function(returnValue) {
      $('input.apply_changes').show();
      if (returnValue["error"] == "true") {
        create_resource_error_processing(
          returnValue["stderr"], form, update, stonith
        );
      } else {
        Pcs.update();
        if (!update) {
          if (stonith)
            $('#new_stonith_agent').dialog('close');
          else
            $('#new_resource_agent').dialog('close');
        } else {
          reload_current_resource();
        }
      }
    },
    error: function(xhr, status, error) {
      create_resource_error_processing(
        ajax_simple_error(xhr, status, error), form, update, stonith
      );
      $('input.apply_changes').show();
    }
  });
}

// Don't allow spaces in input fields
function disable_spaces(item) {
  myitem = item;
  $(item).find("input").on("keydown", function (e) {
    return e.which !== 32;
  });
}

function load_resource_form(agent_name, stonith) {
  stonith = typeof stonith !== 'undefined' ? stonith : false;
  if (!agent_name) {
    return;
  }
  var prop_name = "new_" + (stonith ? "fence" : "resource") + "_agent_metadata";
  get_resource_agent_metadata(agent_name, function (data) {
      Pcs.resourcesContainer.set(prop_name, Pcs.ResourceAgent.create(data));
  }, stonith);
}

function verify_remove(
  remove_func, forceable, checklist_id, dialog_id, label, ok_text, title,
  remove_id, extraDialogOptions
) {
  var remove_id_list;

  if (Array.isArray(remove_id)) {
    remove_id_list = remove_id;
  }else if (remove_id) {
    remove_id_list = [remove_id];
  } else {
    remove_id_list = get_checked_ids_from_nodelist(checklist_id);
  }

  if (remove_id_list.length < 1) {
    alert(translate("You must select at least one ") + label + translate(" to remove."));
    return;
  }

  var buttonOpts = [
    {
      text: ok_text,
      id: "verify_remove_submit_btn",
      click: function() {
        if (remove_id_list.length < 1) {
          return;
        }
        $("#verify_remove_submit_btn").button("option", "disabled", true);
        if (forceable) {
          force = $("#" + dialog_id + " :checked").length > 0;
          remove_func(remove_id_list, force);
        }
        else {
          remove_func(remove_id_list);
        }
      }
    },
    {
      text: translate("Cancel"),
      id: "verify_remove_cancel_btn",
      click: function() {
        $(this).dialog("destroy");
        if (forceable) {
          $("#" + dialog_id + " input[name=force]").attr("checked", false);
        }
      }
    }
  ];

  var name_list = "<ul>";
  $.each(remove_id_list, function(key, remid) {
    name_list += "<li>" + remid + "</li>";
  });
  name_list += "</ul>";
  $("#" + dialog_id + " .name_list").html(name_list);
  dialogOptions = extraDialogOptions || {};
  dialogOptions.title = title;
  dialogOptions.modal = true;
  dialogOptions.resizable = false,
  dialogOptions.buttons = buttonOpts;
  $("#" + dialog_id).dialog(dialogOptions);
}

function verify_remove_clusters(cluster_id) {
  verify_remove(
    remove_cluster, false, "cluster_list", "dialog_verify_remove_clusters",
    translate("cluster"), translate("Remove Cluster(s)"), translate("Cluster Removal"), cluster_id
  );
}

/*
 * TODO Remove - dead code
 * This function was handling the old node remove dialog used in pcs-0.9 for
 * CMAN and Corosync 2 clusters. We keep it here for now until the dialog
 * overhaul is done.
*/
function verify_remove_nodes(node_id) {
  verify_remove(
    remove_nodes, false, "node_list", "dialog_verify_remove_nodes",
    translate("node"), translate("Remove Node(s)"), translate("Remove Node"), node_id
  );
}

function verify_remove_resources(resource_id) {
  verify_remove(
    remove_resource, true, "resource_list", "dialog_verify_remove_resources",
    translate("resource"), translate("Remove resource(s)"), translate("Resource Removal"), resource_id
  );
}

function verify_remove_fence_devices(resource_id) {
  verify_remove(
    remove_resource, false, "stonith_list", "dialog_verify_remove_resources",
    translate("fence device"), translate("Remove device(s)"), translate("Fence Device Removal"), resource_id
  );
}

function verify_remove_acl_roles(role_id) {
  verify_remove(
    remove_acl_roles, false, "acls_roles_list", "dialog_verify_remove_acl_roles",
    translate("ACL role"), translate("Remove Role(s)"), translate("Remove ACL Role"), role_id
  );
}

function get_checked_ids_from_nodelist(nodelist_id) {
  var ids = new Array();
  $("#" + nodelist_id + " .node_list_check :checked").each(function (index, element) {
    if($(element).parent().parent().attr("nodeID")) {
      ids.push($(element).parent().parent().attr("nodeID"));
    }
  });
  return ids;
}

function local_node_update(node, data) {
  node_data = data[node];

  for (var n in data) {
    if (data[n].pacemaker_online && (jQuery.inArray(n, data[n].pacemaker_online) != -1)) {
      setNodeStatus(n, true);
    } else {
      setNodeStatus(n,false);
    }
  }
}

function disable_checkbox_clicks() {
  $('.node_list_check input[type=checkbox]').click(function(e) {
    e.stopPropagation();
  });
}

// Set the status of a service
// 0 = Running (green)
// 1 = Stopped (red)
// 2 = Unknown (gray)
function setStatus(item, status, message) {
  if (status == 0) {
    item.removeClass();
    item.addClass('status');
  } else if (status == 1) {
    item.removeClass();
    item.addClass('status-offline');
  } else if (status == 2) {
    item.removeClass();
    item.addClass('status-unknown');
  }

  if (typeof message !== 'undefined')
    item.html(message);
}

// Set the node in the node list blue or red depending on
// whether pacemaker is connected or not
function setNodeStatus(node, running) {
  if (running) {
    $('.node_name:contains("'+node+'")').css('color','');
  } else {
    $('.node_name:contains("'+node+'")').css('color','red');
  }
}


function fade_in_out(id) {
  $(id).fadeTo(1000, 0.01, function() {
    $(id).fadeTo(1000, 1);
  });
}

function node_link_action(link_selector, url, label) {
  var node = $.trim($("#node_info_header_title_name").text());
  fade_in_out(link_selector);
  ajax_wrapper({
    type: 'POST',
    url: url,
    data: {"name": node},
    success: function() {
    },
    error: function (xhr, status, error) {
      alert(
        "Unable to " + label + " node '" + node + "' "
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function setup_node_links() {
  Ember.debug("Setup node links");
  $("#node_start").click(function() {
    node_link_action(
      "#node_start", get_cluster_remote_url() + "cluster_start", "start"
    );
  });
  $("#node_stop").click(function() {
    var node = $.trim($("#node_info_header_title_name").text());
    fade_in_out("#node_stop");
    node_stop(node, false);
  });
  $("#node_restart").click(function() {
    node_link_action(
      "#node_restart", get_cluster_remote_url() + "node_restart", "restart"
    );
  });
  $("#node_standby").click(function() {
    node_link_action(
      "#node_standby", get_cluster_remote_url() + "node_standby", "standby"
    );
  });
  $("#node_unstandby").click(function() {
    node_link_action(
      "#node_unstandby",
      get_cluster_remote_url() + "node_unstandby",
      "unstandby"
    );
  });
}

function node_stop(node, force) {
  var data = {};
  data["name"] = node;
  if (force) {
    data["force"] = force;
  }
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'cluster_stop',
    data: data,
    timeout: pcs_timeout,
    success: function() {
    },
    error: function(xhr, status, error) {
      if ((status == "timeout") || ($.trim(error) == "timeout")) {
        /*
         We are not interested in timeout because:
         - it can take minutes to stop a node (resources running on it have
           to be stopped/moved and we do not need to wait for that)
         - if pcs is not able to stop a node it returns an (forceable) error
           immediatelly
        */
        return;
      }
      var message = "Unable to stop node '" + node + "' " + ajax_simple_error(
        xhr, status, error
      );
      if (message.indexOf('--force') == -1) {
        alert(message);
      }
      else {
        message = message.replace(', use --force to override', '');
        if (confirm(message + "\n\nDo you want to force the operation?")) {
          node_stop(node, true);
        }
      }
    }
  });
}

function enable_resource() {
  fade_in_out("#resource_start_link");
  Pcs.resourcesContainer.enable_resource(curResource());
}

function disable_resource() {
  fade_in_out("#resource_stop_link");
  Pcs.resourcesContainer.disable_resource(curResource());
}

function resource_stonith_cleanup_refresh(
  resource, action_button_id, action_url, action_label, full_refresh
) {
  if (resource == null) {
    return;
  }
  data = {"resource": resource};
  if (full_refresh) {
    data["full"] = 1;
  }
  fade_in_out(action_button_id);
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + action_url,
    data: data,
    success: function() {
    },
    error: function (xhr, status, error) {
      alert(
        "Unable to " + action_label + " resource '" + resource + "' "
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function cleanup_resource() {
  resource_stonith_cleanup_refresh(
    curResource(),
    "#resource_cleanup_link",
    "resource_cleanup",
    "cleanup"
  );
}

function cleanup_stonith() {
  resource_stonith_cleanup_refresh(
    curStonith(),
    "#stonith_cleanup_link",
    "resource_cleanup",
    "cleanup"
  );
}

function refresh_resource(refresh_supported) {
  resource_stonith_cleanup_refresh(
    curResource(),
    "#resource_refresh_link",
    /* previously, "refresh" was called "cleanup" */
    refresh_supported ? "resource_refresh" : "resource_cleanup",
    "refresh",
    /* no way to set if we want to do the full (on all nodes) refresh from gui
     * (yet);
     * moreover the full refresh flag only works for refresh not for cleanup */
    refresh_supported ? true : false
  );
}

function refresh_stonith(refresh_supported) {
  resource_stonith_cleanup_refresh(
    curStonith(),
    "#stonith_refresh_link",
    /* previously, "refresh" was called "cleanup" */
    refresh_supported ? "resource_refresh" : "resource_cleanup",
    "refresh",
    /* no way to set if we want to do the full (on all nodes) refresh from gui
     * (yet);
     * moreover the full refresh flag only works for refresh not for cleanup */
    refresh_supported ? true : false
  );
}

function checkExistingNode() {
  var node = "";
  $('input[name="node-name"]').each(function(i,e) {
    node = e.value;
  });
  ajax_wrapper({
    type: 'GET',
    url: '/manage/check_auth_against_nodes',
    data: {"node_list": [node]},
    timeout: pcs_timeout,
    success: function (data) {
      update_existing_cluster_dialog(jQuery.parseJSON(data));

    },
    error: function (XMLHttpRequest, textStatus, errorThrown) {
      alert("ERROR: Unable to contact server");
    }
  });
}

function auth_nodes(dialog) {
  $("#auth_failed_error_msg").hide();
  var form = dialog.find("#auth_nodes_form");
  var nodes = {};
  var custom_addr_port = form.find('input:checkbox[name=custom_addr_port]').prop('checked');
  form.find('#auth_nodes_list input').each(function() {
    var input = $(this);
    if(input.attr('name').startsWith('pass-')) {
      var nodename = input.attr('name').slice('pass-'.length);
      if(!nodes[nodename]) {
        nodes[nodename] = {"password": "", "addr": "", "port": ""};
      }
      nodes[nodename]['password'] = input.val();
    }
    else if(custom_addr_port && input.attr('name').startsWith('port-')) {
      var nodename = input.attr('name').slice('port-'.length);
      if(!nodes[nodename]) {
        nodes[nodename] = {"password": "", "addr": "", "port": ""};
      }
      nodes[nodename]['port'] = input.val().trim();
      if(nodes[nodename]['port'].length < 1) {
        nodes[nodename]['port'] = input.prop('placeholder');
      }
    }
    else if(custom_addr_port && input.attr('name').startsWith('addr-')) {
      var nodename = input.attr('name').slice('addr-'.length);
      if(!nodes[nodename]) {
        nodes[nodename] = {"password": "", "addr": "", "port": ""};
      }
      nodes[nodename]['addr'] = input.val().trim();
      if(nodes[nodename]['addr'].length < 1) {
        nodes[nodename]['addr'] = nodename;
      }
    }
  });
  if(form.find('input:checkbox[name=all]').prop('checked')) {
    var passwd_for_all = form.find('input[name=pass-all]').val();
    $.each(nodes, function(node_name, node_data) {
      node_data.password = passwd_for_all;
    });
  }

  var nodes_for_request = {};
  $.each(nodes, function(node_name, node_data) {
    nodes_for_request[node_name] = {
      password: node_data['password'],
      dest_list: [
        {
          addr: node_data['addr'],
          port: node_data['port']
        }
      ]
    };
  });

  ajax_wrapper({
    type: 'POST',
    url: '/manage/auth_gui_against_nodes',
    data: {
      data_json: JSON.stringify({
        nodes: nodes_for_request,
      })
    },
    timeout: pcs_timeout,
    success: function (data) {
      mydata = jQuery.parseJSON(data);
      auth_nodes_dialog_update(dialog, mydata);
    },
    error: function (XMLHttpRequest, textStatus, errorThrown) {
      alert("ERROR: Unable to contact server");
    }
  });
}

function auth_nodes_dialog_update(dialog_obj, data) {
  var unauth_nodes = [];
  var node;
  var plaintext_error = "";
  var cannot_save_new_hosts = false;

  if (data['plaintext_error']) {
    plaintext_error += "\n\n" + data['plaintext_error'];
  }

  if (data['node_auth_error']) {
    for (node in data['node_auth_error']) {
      if (data['node_auth_error'][node] != 0) {
        unauth_nodes.push(node);
      }
    }
  }

  if (data['local_cluster_node_auth_error']) {
    for (node in data['local_cluster_node_auth_error']) {
      if (data['local_cluster_node_auth_error'][node] != 0) {
        unauth_nodes.push(node);
        cannot_save_new_hosts = true;
      }
    }
  }
  if (cannot_save_new_hosts) {
    plaintext_error += (
      "\n\n"
      +
      "Unable to save new cluster settings as the local cluster nodes are not "
      +
      "authenticated. Please, authenticate them as well."
    );
  }

  if (plaintext_error.length > 0) {
    alert($.trim(plaintext_error));
  }

  var callback_one = dialog_obj.dialog("option", "callback_success_one_");
  var callback = dialog_obj.dialog("option", "callback_success_");
  if (unauth_nodes.length == 0) {
    dialog_obj.parent().find("#authenticate_submit_btn").button(
      "option", "disabled", false
    );
    dialog_obj.find("#auth_failed_error_msg").hide();
    dialog_obj.dialog("close");
    if (callback_one !== null)
      callback_one();
    if (callback !== null)
      callback();
    return unauth_nodes;
  } else {
    dialog_obj.find("#auth_failed_error_msg").show();
  }

  // add rows for local cluster nodes which are not authenticated
  $.each(unauth_nodes, function(i, node) {
    if (
      dialog_obj.find("input:password[name='pass-" + node + "']").length == 0
    ) {
      auth_nodes_dialog_add_node_row(dialog_obj, node);
    }
  });
  // hide advanced settings for new rows if appropriate
  dialog_obj.find("input:checkbox[name='custom_addr_port']").each(
    function(){
      if ($(this).is(':checked')) {
        $('#auth_nodes_form').find('.addr_port').show();
      } else {
        $('#auth_nodes_form').find('.addr_port').hide();
      }
    }
  );
  auth_nodes_dialog_toggle_same_pass(dialog_obj, unauth_nodes.length);

  var one_success = false;
  dialog_obj.find("input:password[name^=pass-]").each(function() {
    node = $(this).attr("name");
    if (node == "pass-all") {
      // do not remove / modify the row common to all nodes
      return;
    }
    node = node.substring("pass-".length);
    if (unauth_nodes.indexOf(node) == -1) {
      $(this).parent().parent().remove();
      one_success = true;
    } else {
      $(this).parent().parent().css("color", "red");
    }
  });

  if (one_success && callback_one !== null)
    callback_one();

  dialog_obj.parent().find("#authenticate_submit_btn").button(
    "option", "disabled", false
  );
  return unauth_nodes;
}

function auth_nodes_dialog(unauth_nodes, callback_success, callback_success_one) {
  callback_success = typeof callback_success !== 'undefined' ? callback_success : null;
  callback_success_one = typeof callback_success_one !== 'undefined' ? callback_success_one : null;

  var buttonsOpts = [
    {
      text: translate("Authenticate"),
      id: "authenticate_submit_btn",
      click: function() {
        var dialog = $(this);
        dialog.parent().find("#authenticate_submit_btn").button(
          "option", "disabled", true
        );
        dialog.find("table.err_msg_table").find("span[id$=_error_msg]").hide();
        auth_nodes(dialog);
      }
    },
    {
      text:translate("Cancel"),
      click: function () {
        $(this).dialog("close");
      }
    }
  ];
  var dialog_obj = $("#auth_nodes").dialog({
    title: translate('Authentication of nodes'),
    modal: true,
    resizable: false,
    width: 'auto',
    buttons: buttonsOpts,
    callback_success_: callback_success,
    callback_success_one_: callback_success_one
  });

  dialog_obj.find("#auth_failed_error_msg").hide();

  // If you hit enter it triggers the submit button
  dialog_obj.keypress(function(e) {
    if (e.keyCode == $.ui.keyCode.ENTER && !dialog_obj.parent().find("#authenticate_submit_btn").button("option", "disabled")) {
      dialog_obj.parent().find("#authenticate_submit_btn").trigger("click");
      return false;
    }
  });
  unauth_nodes_count = unauth_nodes.length;

  if (unauth_nodes_count == 0) {
    if (callback_success !== null) {
      callback_success();
    }
    return;
  }

  auth_nodes_dialog_toggle_same_pass(dialog_obj, unauth_nodes_count);

  dialog_obj.find("input:checkbox[name=custom_addr_port]").prop("checked", false);
  dialog_obj.find('#auth_nodes_list').empty();
  dialog_obj.find('#auth_nodes_list').append('<tr><td>Node</td><td class="password">Password</td><td class="addr_port">Address</td><td class="addr_port">Port</td></tr>');
  $.each(unauth_nodes, function(i, node) {
    auth_nodes_dialog_add_node_row(dialog_obj, node)
  });
  dialog_obj.find(".addr_port").hide();

}

function auth_nodes_dialog_toggle_same_pass(dialog_obj, unauth_nodes_count) {
  if (unauth_nodes_count == 1) {
    dialog_obj.find("#same_pass").hide();
    dialog_obj.find('#auth_nodes_list').find('input:password').each(
      function(){$(this).show()}
    );
  } else {
    dialog_obj.find("#same_pass").show();
    dialog_obj.find("input:checkbox[name=all]").prop("checked", false);
    dialog_obj.find("#pass_for_all").val("");
    dialog_obj.find("#pass_for_all").hide();
  }
}

function auth_nodes_dialog_add_node_row(dialog_obj, node) {
    var html = "<tr>";
    html += "<td>" + htmlEncode(node) + "</td>";
    html += '<td class="password"><input type="password" name="pass-' + htmlEncode(node) + '"></td>';
    html += '<td class="addr_port"><input type="text" name="addr-' + htmlEncode(node) + '"></td>';
    html += '<td class="addr_port">:<input type="text" size="5" name="port-' + htmlEncode(node) + '" placeholder="2224" /></td>';
    html += "</tr>";
    dialog_obj.find('#auth_nodes_list').append(html);
}

function add_existing_dialog() {
  var buttonOpts = [
    {
      text: translate("Add Existing"),
      id: "add_existing_submit_btn",
      click: function () {
        $("#add_existing_cluster").find("table.err_msg_table").find("span[id$=_error_msg]").hide();
        $("#add_existing_submit_btn").button("option", "disabled", true);
        checkExistingNode();
      }
    },
    {
      text: translate("Cancel"),
      click: function() {
        $(this).dialog("close");
      }
    }
  ];

  // If you hit enter it triggers the first button: Add Existing
  $('#add_existing_cluster').keypress(function(e) {
    if (e.keyCode == $.ui.keyCode.ENTER && !$("#add_existing_submit_btn").button("option", "disabled")) {
      $(this).parent().find("button:eq(1)").trigger("click");
      return false;
    }
  });

  $("#add_existing_cluster").dialog({title: translate('Add Existing Cluster'),
    modal: false, resizable: false,
    width: 'auto',
    buttons: buttonOpts
  });
}

function update_existing_cluster_dialog(data) {
  for (var node in data) {
    if (data[node] == "Online") {
      ajax_wrapper({
        type: "POST",
        url: "/manage/existingcluster",
        timeout: pcs_timeout,
        data: $('#add_existing_cluster_form').serialize(),
        success: function(data) {
          if (data) {
            alert("Operation Successful!\n\nWarnings:\n" + data);
          }
          $("#add_existing_cluster.ui-dialog-content").each(function(key, item) {$(item).dialog("destroy")});
          Pcs.update();
        },
        error: function (xhr, status, error) {
          alert(xhr.responseText);
          $("#add_existing_submit_btn").button("option", "disabled", false);
        }
      });
      return;
    } else if (
      (data[node] == "Unable to authenticate")
      ||
      (data[node] == "Offline")
    ) {
      if(data[node] == "Offline") {
        alert("Unable to contact node '" + node + "'");
      }
      auth_nodes_dialog([node], function() {$("#add_existing_submit_btn").trigger("click")});
      $("#add_existing_submit_btn").button("option", "disabled", false);
      return;
    }
    break;
  }
  if (data.length > 0) {
    $('#add_existing_cluster_error_msg').html(i + ": " + data[i]);
    $('#add_existing_cluster_error_msg').show();
  }
  $('#unable_to_connect_error_msg_ae').show();
  $("#add_existing_submit_btn").button("option", "disabled", false);
}

function show_hide_constraints(element) {
  //$(element).parent().siblings().each (function(index,element) {
  $(element).parent().nextUntil(".stop").toggle();
  $(element).children("span, p").toggle();
}

function show_hide_constraint_tables(element) {
  $(element).siblings().hide();
  $("#add_constraint_" + $(element).val()).show();
}

function hover_over(o) {
  $(o).addClass("node_selected");
}

function hover_out(o) {
  $(o).removeClass("node_selected");
}

function reload_current_resource() {
  tree_view_onclick(curResource());
  tree_view_onclick(curStonith());
}

function load_row(node_row, ac, cur_elem, containing_elem, also_set, initial_load){
  hover_over(node_row);
  $(node_row).siblings().each(function(key,sib) {
    hover_out(sib);
  });
  var self = ac;
  $(containing_elem).fadeTo(500, .01,function() {
    node_name = $(node_row).attr("nodeID");
    $.each(self.content, function(key, node) {
      if (node.name == node_name) {
        if (!initial_load) {
          self.set(cur_elem,node);
        }
        node.set(cur_elem, true);
        if (also_set)
          self.set(also_set, node);
      } else {
        if (self.cur_resource_ston && self.cur_resource_ston.name == node.name)
          self.content[key].set(cur_elem,true);
        else if (self.cur_resource_res && self.cur_resource_res.name == node.name)
          self.content[key].set(cur_elem,true);
        else
          self.content[key].set(cur_elem,false);
      }
    });
    $(containing_elem).fadeTo(500,1);
  });
}

function show_loading_screen() {
  $("#loading_screen_progress_bar").progressbar({ value: 100});
  $("#loading_screen").dialog({
    modal: true,
    title: translate("Loading"),
    height: 100,
    width: 250,
    hide: {
      effect: 'fade',
      direction: 'down',
      speed: 750
    }
  });
}

function hide_loading_screen() {
  $("#loading_screen").dialog('close');
  destroy_tooltips();
}

function destroy_tooltips() {
  $("div[id^=ui-tooltip-]").remove();
}

function remove_cluster(ids) {
  var data = {};
  $.each(ids, function(_, cluster) {
    data[ "clusterid-" + cluster] = true;
  });
  ajax_wrapper({
    type: 'POST',
    url: '/manage/removecluster',
    data: data,
    timeout: pcs_timeout,
    success: function () {
      $("#dialog_verify_remove_clusters.ui-dialog-content").each(function(key, item) {$(item).dialog("destroy")});
      Pcs.update();
    },
    error: function (xhr, status, error) {
      alert(
        "Unable to remove cluster "
        + ajax_simple_error(xhr, status, error)
      );
      $("#dialog_verify_remove_clusters.ui-dialog-content").each(function(key, item) {$(item).dialog("destroy")});
    }
  });
}

/*
 * TODO Remove - dead code
 * This function was handling the old node remove dialog used in pcs-0.9 for
 * CMAN and Corosync 2 clusters. We keep it here for now until the dialog
 * overhaul is done.
*/
function remove_nodes(ids, force) {
  var data = {};
  for (var i=0; i<ids.length; i++) {
    data["nodename-"+i] = ids[i];
  }
  if (force) {
    data["force"] = force;
  }

  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'remove_nodes',
    data: data,
    timeout: pcs_timeout*3,
    success: function(data,textStatus) {
      $("#dialog_verify_remove_nodes.ui-dialog-content").each(function(key, item) {$(item).dialog("destroy")});
      if (data == "No More Nodes") {
        window.location.href = "/manage";
      } else {
        Pcs.update();
      }
    },
    error: function (xhr, status, error) {
      $("#dialog_verify_remove_nodes.ui-dialog-content").each(function(key, item) {$(item).dialog("destroy")});
      if ((status == "timeout") || ($.trim(error) == "timeout")) {
        /*
         We are not interested in timeout because:
         - it can take minutes to stop a node (resources running on it have
           to be stopped/moved and we do not need to wait for that)
         - if pcs is not able to stop a node it returns an (forceable) error
           immediatelly
        */
        return;
      }
      var message = "Unable to remove nodes (" + $.trim(error) + ")";
      message += "\n" + xhr.responseText;
      if (message.indexOf('--force') == -1) {
        alert(message);
      }
      else {
        message = message.replace(', use --force to override', '');
        if (confirm(message + "\n\nDo you want to force the operation?")) {
          remove_nodes(ids, true);
        }
      }
    }
  });
}

function remove_resource(ids, force) {
  var data = {
    no_error_if_not_exists: true
  };
  if (force) {
    data["force"] = force;
  }
  var res_obj;
  $.each(ids, function(_, id) {
    res_obj = Pcs.resourcesContainer.get_resource_by_id(id);
    if (!res_obj) {
      return true; // continue
    } else if ($.inArray(res_obj.get("parent_id"), ids) == -1) {
      data["resid-" + id] = true;
    }
  });

  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'remove_resource',
    data: data,
    timeout: pcs_timeout*3,
    success: function () {
      $("#dialog_verify_remove_resources.ui-dialog-content").each(function(key, item) {$(item).dialog("destroy")});
      $("#dialog_verify_remove_resources input[name=force]").attr("checked", false);
      Pcs.update();
    },
    error: function (xhr, status, error) {
      error = $.trim(error);
      var message = "";
      if (
        status == "timeout" ||
        error == "timeout" ||
        xhr.responseText == '{"noresponse":true}'
      ) {
        message = "Operation takes longer to complete than expected.";
      } else {
        message = "Unable to remove resources (" + error + ")";
        if (
          (xhr.responseText.substring(0, 6) == "Error:") ||
          ("Forbidden" == error)
        ) {
          message += "\n\n" + xhr.responseText.replace(
            "--force", "'Enforce removal'"
          );
          alert(message);
          $("#verify_remove_submit_btn").button("option", "disabled", false);
          return;
        }
      }
      alert(message);
      $("#dialog_verify_remove_resources.ui-dialog-content").each(
        function(key, item) { $(item).dialog("destroy") }
      );
      $("#dialog_verify_remove_resources input[name=force]").attr("checked", false);
      Pcs.update();
    }
  });
}

function add_remove_fence_level(parent_id,remove) {
  var data = {};
  if (remove == true) {
    data["remove"] = true;
    data["level"] = parent_id.attr("fence_level");
    data["node"] = Pcs.nodesController.cur_node.name;
    data["devices"] = parent_id.attr("fence_devices");
  } else {
    data["level"] = parent_id.parent().find("input[name='new_level_level']").val();
    data["devices"] = parent_id.parent().find("select[name='new_level_value']").val();
    data["node"] = Pcs.nodesController.cur_node.name;
  }
  fade_in_out(parent_id.parent());
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'add_fence_level_remote',
    data: data,
    timeout: pcs_timeout,
    success: function() {
//      Pcs.nodesController.remove_fence_level();
      if (!remove) {
        $(parent_id.parent()).find("input").val("");
        $(parent_id.parent()).find("select").val("");
      }
      Pcs.update();
    },
    error: function (xhr, status, error) {
      if (remove) {
        alert(
          "Unable to remove fence level "
          + ajax_simple_error(xhr, status, error)
        );
      }
      else {
        if (xhr.responseText.substring(0,6) == "Error:") {
          alert(xhr.responseText);
        } else {
          alert(
            "Unable to add fence level "
            + ajax_simple_error(xhr, status, error)
          );
        }
      }
    }
  });
}

function remove_node_attr(parent_id) {
  var data = {};
  data["node"] = Pcs.nodesController.cur_node.name;
  data["key"] = parent_id.attr("node_attr_key");
  data["value"] = ""; // empty value will remove attribute
  fade_in_out(parent_id.parent());

  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'add_node_attr_remote',
    data: data,
    timeout: pcs_timeout,
    success: function() {
//      Pcs.nodesController.remove_node_attr(data["res_id"], data["key"]);
      Pcs.update();
    },
    error: function (xhr, status, error) {
      alert(
        "Unable to remove node attribute "
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function add_node_attr(parent_id) {
  var data = {};
  data["node"] = Pcs.nodesController.cur_node.name;
  data["key"] = $(parent_id + " input[name='new_node_attr_key']").val();
  data["value"] = $(parent_id + " input[name='new_node_attr_value']").val();
  fade_in_out($(parent_id));

  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'add_node_attr_remote',
    data: data,
    timeout: pcs_timeout,
    success: function() {
      $(parent_id + " input").val("");
//      Pcs.nodesController.add_node_attr(data["res_id"], data["key"], data["value"]);
      Pcs.update();
    },
    error: function (xhr, status, error) {
      alert(
        translate("Unable to add node attribute")
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function node_maintenance(node) {
  var data = {
    node: node,
    key: "maintenance",
    value: "on"
  };
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'add_node_attr_remote',
    data: data,
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to put node '" + node + "' to maintenance mode. "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function node_unmaintenance(node) {
  var data = {
    node: node,
    key: "maintenance",
    value: ""
  };
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'add_node_attr_remote',
    data: data,
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to remove node '" + node + "' from maintenance mode. "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function remove_meta_attr(parent_id) {
  var resource_id = curResource();
  if (resource_id == null) {
    return;
  }
  var attr = parent_id.attr("meta_attr_key");
  fade_in_out(parent_id.parent());
  Pcs.resourcesContainer.update_meta_attr(resource_id, attr);
}

function add_meta_attr(parent_id) {
  var resource_id = curResource();
  if (resource_id == null) {
    return;
  }
  var attr = $(parent_id + " input[name='new_meta_key']").val();
  var value = $(parent_id + " input[name='new_meta_value']").val();
  fade_in_out($(parent_id));
  $(parent_id + " input").val("");
  Pcs.resourcesContainer.update_meta_attr(resource_id, attr, value);
}


function add_constraint_prepare_data(parent_id, constraint_type){
  var value = function(sibling){
    var form_value = $(parent_id + " " + sibling).val();
    return form_value ? form_value.trim() : form_value;
  };
  switch(constraint_type){
    case "ticket": return {
      ticket: value("input[name='ticket']"),
      role: value("select[name='role']"),
      "loss-policy": value("select[name='loss-policy']"),
    };
  }
  return {
    rule: value("input[name='node_id']"),
    score: value("input[name='score']"),
    target_res_id: value("input[name='target_res_id']"),
    order: value("select[name='order']"),
    target_action: value("select[name='target_action']"),
    res_action: value("select[name='res_action']"),
    colocation_type: value("select[name='colocate']"),
  };
}

function add_constraint(parent_id, c_type, force) {
  var data = add_constraint_prepare_data(parent_id, c_type);
  if (!Pcs.pcmk_constraint_no_autocorrect) {
    data["disable_autocorrect"] = true;
  }
  data["res_id"] = Pcs.resourcesContainer.cur_resource.get('id');
  data["node_id"] = $(parent_id + " input[name='node_id']").val();
  data["c_type"] = c_type;
  if (force) {
    data["force"] = force;
  }
  fade_in_out($(parent_id));

  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + (
      data['node_id'] && (data['node_id'].trim().indexOf(' ') != -1)
      ? 'add_constraint_rule_remote'
      : 'add_constraint_remote'
    ),
    data: data,
    timeout: pcs_timeout,
    success: function() {
      $(parent_id + " input").val("");
      Pcs.update();
    },
    error: function (xhr, status, error) {
      // var message = "Unable to add constraint (" + $.trim(error) + ")";
      var message = translate("Unable to add constraint",$.trim(error));
      var error_prefix = 'Error adding constraint: ';
      if (xhr.responseText.indexOf('cib_replace failed') == -1) {
        if (xhr.responseText.indexOf(error_prefix) == 0) {
          message += "\n\n" + xhr.responseText.slice(error_prefix.length);
        }
        else {
          message += "\n\n" + xhr.responseText;
        }
      }
      if (message.indexOf('--force') == -1) {
        alert(message);
        Pcs.update();
      }
      else {
        message = message.replace(', use --force to override', '');
        message = message.replace('Use --force to override.', '');
        if (confirm(message + "\n\nDo you want to force the operation?")) {
          add_constraint(parent_id, c_type, true);
        }
      }
    }
  });
}

function add_constraint_set_get_options(parent_id, constraint_type){
  switch(constraint_type){
    case "ticket": return {
      ticket: $(parent_id + " input[name='ticket']").val().trim(),
      "loss-policy": $(parent_id + " select[name='loss-policy']").val().trim(),
    };
  }
  return {};
}

function add_constraint_set(parent_id, c_type, force) {
  var data = {
    resources: [],
    options: {},
  };
  if (!Pcs.pcmk_constraint_no_autocorrect) {
    data["disable_autocorrect"] = true;
  }
  $(parent_id + " input[name='resource_ids[]']").each(function(index, element) {
    var resources = element.value.trim();
    if (resources.length > 0) {
      data['resources'].push(resources.split(/\s+/));
    }
  });
  data.options = add_constraint_set_get_options(parent_id, c_type);
  data["c_type"] = c_type;
  if (force) {
    data["force"] = force;
  }
  if (data['resources'].length < 1) {
    return;
  }
  fade_in_out($(parent_id));

  ajax_wrapper({
    type: "POST",
    url: get_cluster_remote_url() + "add_constraint_set_remote",
    data: data,
    timeout: pcs_timeout,
    success: function() {
      reset_constraint_set_form(parent_id);
      Pcs.update();
    },
    error: function (xhr, status, error){
      var message = "Unable to add constraint (" + $.trim(error) + ")";
      var error_prefix = 'Error adding constraint: ';
      if (xhr.responseText.indexOf('cib_replace failed') == -1) {
        if (xhr.responseText.indexOf(error_prefix) == 0) {
          message += "\n\n" + xhr.responseText.slice(error_prefix.length);
        }
        else {
          message += "\n\n" + xhr.responseText;
        }
      }
      if (message.indexOf('--force') == -1) {
        alert(message);
        Pcs.update();
      }
      else {
        message = message.replace(', use --force to override', '');
        message = message.replace('Use --force to override.', '');
        if (confirm(message + "\n\nDo you want to force the operation?")) {
          add_constraint_set(parent_id, c_type, true);
        }
      }
    },
  });
}

function new_constraint_set_row(parent_id) {
  var set = translate("Set");
  $(parent_id + " td").first().append(
    '<br>' + set + ': <input type="text" name="resource_ids[]">'
  );
}

function reset_constraint_set_form(parent_id) {
  $(parent_id + " td").first().html(
    'Set: <input type="text" name="resource_ids[]">'
  );
}

function remove_constraint(id) {
  fade_in_out($("[constraint_id='"+id+"']").parent());
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'remove_constraint_remote',
    data: {"constraint_id": id},
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Error removing constraint "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function remove_constraint_action(remover_element){
  remove_constraint($(remover_element).parent().attr('constraint_id'));
  return false;
}

function remove_constraint_rule(id) {
  fade_in_out($("[rule_id='"+id+"']").parent());
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'remove_constraint_rule_remote',
    data: {"rule_id": id},
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Error removing constraint rule "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function add_acl_role(form) {
  var data = {};
  data["name"] = $(form).find("input[name='name']").val().trim();
  data["description"] = $(form).find("input[name='description']").val().trim();
  ajax_wrapper({
    type: "POST",
    url: get_cluster_remote_url() + "add_acl_role",
    data: data,
    success: function(data) {
      Pcs.update();
      $(form).find("input").val("");
      $("#add_acl_role").dialog("close");
    },
    error: function(xhr, status, error) {
      alert(
        translate("Error adding ACL role")
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function remove_acl_roles(ids) {
  var data = {};
  for (var i = 0; i < ids.length; i++) {
    data["role-" + i] = ids[i];
  }
  ajax_wrapper({
    type: "POST",
    url: get_cluster_remote_url() + "remove_acl_roles",
    data: data,
    timeout: pcs_timeout*3,
    success: function(data,textStatus) {
      $("#dialog_verify_remove_acl_roles.ui-dialog-content").each(
        function(key, item) { $(item).dialog("destroy") }
      );
      Pcs.update();
    },
    error: function (xhr, status, error) {
      alert(
        "Error removing ACL role "
        + ajax_simple_error(xhr, status, error)
      );
      $("#dialog_verify_remove_acl_roles.ui-dialog-content").each(
        function(key, item) { $(item).dialog("destroy") }
      );
    }
  });
}

function add_acl_item(parent_id, item_type) {
  var data = {};
  data["role_id"] = Pcs.aclsController.cur_role.name;
  var item_label = "";
  switch (item_type) {
    case "perm":
      data["item"] = "permission";
      data["type"] = $(parent_id + " select[name='role_type']").val();
      data["xpath_id"] = $(parent_id + " select[name='role_xpath_id']").val();
      data["query_id"] = $(parent_id + " input[name='role_query_id']").val().trim();
      item_label = "permission";
      break;
    case "user":
    case "group":
      data["item"] = item_type;
      data["usergroup"] = $(parent_id + " input[name='role_assign_user']").val().trim();
      item_label = item_type;
      break;
  }
  fade_in_out($(parent_id));
  ajax_wrapper({
    type: "POST",
    url: get_cluster_remote_url() + 'add_acl',
    data: data,
    timeout: pcs_timeout,
    success: function(data) {
      $(parent_id + " input").val("");
      Pcs.update();
    },
    error: function (xhr, status, error) {
      alert(
        "Error adding " + item_label + " "
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function remove_acl_item(id,item) {
  fade_in_out(id);
  var data = {};
  var item_label = "";
  switch (item) {
    case "perm":
      data["item"] = "permission";
      data["acl_perm_id"] = id.attr("acl_perm_id");
      item_label = "permission";
      break;
    case "group":
    case "user":
      data["item"] = "usergroup";
      data["item_type"] = item;
      data["usergroup_id"] = id.attr("usergroup_id");
      data["role_id"] = id.attr("role_id");
      item_label = "user / group";
      break;
  }

  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'remove_acl',
    data: data,
    timeout: pcs_timeout,
    success: function (data) {
      Pcs.update();
    },
    error: function (xhr, status, error) {
      alert(
        "Error removing " + item_label + " "
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function update_cluster_settings() {
  $("#cluster_properties button").prop("disabled", true);
  var data = {
    'hidden[hidden_input]': null // this is needed for backward compatibility
  };
  $.each(Pcs.settingsController.get("properties"), function(_, prop) {
    data[prop.get("form_name")] = prop.get("cur_val");
  });
  show_loading_screen();
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'update_cluster_settings',
    data: data,
    timeout: pcs_timeout,
    success: function() {
      refresh_cluster_properties();
    },
    error: function (xhr, status, error) {
      alert(
        "Error updating configuration "
        + ajax_simple_error(xhr, status, error)
      );
      hide_loading_screen();
      $("#cluster_properties button").prop("disabled", false);
    }
  });
}

function refresh_cluster_properties() {
  Pcs.settingsController.set("filter", "");
  $("#cluster_properties button").prop("disabled", true);
  ajax_wrapper({
    url: get_cluster_remote_url() + "cluster_properties",
    timeout: pcs_timeout,
    dataType: "json",
    success: function(data) {
      Pcs.settingsController.update(data);
    },
    error: function (xhr, status, error) {
      Pcs.settingsController.set("error", true);
    },
    complete: function() {
      hide_loading_screen();
      $("#cluster_properties button").prop("disabled", false);
    }
  });
}

// Pull currently managed cluster name out of URL
function get_cluster_name() {
  var cluster_name = location.pathname.match("/managec/(.*)/");
  if (cluster_name && cluster_name.length >= 2) {
    Ember.debug("Cluster Name: " + cluster_name[1]);
    cluster_name = cluster_name[1];
    return cluster_name;
  }
  Ember.debug("Cluster Name is 'null'");
  cluster_name = null;
  return cluster_name;
}

function get_cluster_remote_url(cluster_name) {
  cluster_name = typeof cluster_name !== 'undefined' ? cluster_name : Pcs.cluster_name;
  return '/managec/' + cluster_name + "/";
}

function checkBoxToggle(cb,nodes) {
  if (nodes) {
    cbs = $('#node_list table').find(".node_list_check input[type=checkbox]");
  } else {
    cbs = $(cb).closest("tr").parent().find(".node_list_check input[type=checkbox]");
  }
  if ($(cb).prop('checked'))
    cbs.prop('checked',true).change();
  else
    cbs.prop('checked',false).change();
}

function update_resource_type_options() {
  var cp = $("#resource_class_provider_selector").val();
  var target = $("#add_ra_type");
  var source = $("#all_ra_types");

  target.empty();
  source.find("option").each(function(i,v) {
    if ($(v).val().indexOf(cp) == 0) {
      new_option = $(v).clone();
      target.append(new_option);
    }
  });
  target.change();
}

function setup_resource_class_provider_selection() {
  $("#resource_class_provider_selector").change(function() {
    update_resource_type_options();
  });
  $("#resource_class_provider_selector").change();
}

function get_status_value(status) {
  var values = {
    failed: 1,
    error: 1,
    offline: 1,
    blocked: 1,
    warning: 2,
    standby: 2,
    maintenance: 2,
    "partially running": 2,
    disabled: 3,
    unmanaged: 3,
    unknown: 4,
    ok: 5,
    running: 5,
    online: 5
  };
  return ((values.hasOwnProperty(status)) ? values[status] : -1);
}

function status_comparator(a,b) {
  var valA = get_status_value(a);
  var valB = get_status_value(b);
  if (valA == -1) return 1;
  if (valB == -1) return -1;
  return valA - valB;
}

function get_status_icon_class(status_val, is_unmanaged) {
  var is_unmanaged = typeof is_unmanaged !== 'undefined' ? is_unmanaged : false;
  switch (status_val) {
    case get_status_value("error"):
      return "error";
    case get_status_value("disabled"):
    case get_status_value("warning"):
      return "warning";
    case get_status_value("ok"):
      return is_unmanaged ? "warning" : "check";
    default:
      return "x";
  }
}

function get_status_color(status_val, is_unmanaged) {
  var is_unmanaged = typeof is_unmanaged !== 'undefined' ? is_unmanaged : false;
  if (status_val == get_status_value("ok")) {
    return is_unmanaged? "orange" : "green";
  }
  else if (status_val == get_status_value("warning") || status_val == get_status_value("unknown") || status_val == get_status_value('disabled')) {
    return "orange";
  }
  return "red";
}

function show_hide_dashboard(element, type) {
  var cluster = Pcs.clusterController.cur_cluster;
  if (Pcs.clusterController.get("show_all_" + type)) { // show only failed
    Pcs.clusterController.set("show_all_" + type, false);
  } else { // show all
    Pcs.clusterController.set("show_all_" + type, true);
  }
  correct_visibility_dashboard_type(cluster, type);
}

function correct_visibility_dashboard(cluster) {
  if (cluster == null)
    return;
  $.each(["nodes", "resources", "fence"], function(key, type) {
    correct_visibility_dashboard_type(cluster, type);
  });
}

function correct_visibility_dashboard_type(cluster, type) {
  if (cluster == null) {
    return;
  }
  destroy_tooltips();
  var listTable = $("#cluster_info_" + cluster.name).find("table." + type + "_list");
  var datatable = listTable.find("table.datatable");
  if (Pcs.clusterController.get("show_all_" + type)) {
    listTable.find("span.downarrow").show();
    listTable.find("span.rightarrow").hide();
    datatable.find("tr.default-hidden").removeClass("hidden");
  } else {
    listTable.find("span.downarrow").hide();
    listTable.find("span.rightarrow").show();
    datatable.find("tr.default-hidden").addClass("hidden");
  }
  if (cluster.get(type + "_failed") == 0 && !Pcs.clusterController.get("show_all_" + type)) {
    datatable.hide();
  } else {
    datatable.show();
  }
}

function get_formated_html_list(data) {
  if (data == null || data.length == 0) {
    return "";
  }
  var out = "<ul>";
  $.each(data, function(key, value) {
    out += "<li>" + htmlEncode(value.message) + "</li>";
  });
  out += "</ul>";
  return out;
}

function htmlEncode(s)
{
  return $("<div/>").text(s).html().replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function fix_auth_of_cluster() {
  show_loading_screen();
  var clustername = Pcs.clusterController.cur_cluster.name;
  ajax_wrapper({
    url: get_cluster_remote_url(clustername) + "fix_auth_of_cluster",
    type: "POST",
    success: function(data) {
      hide_loading_screen();
      Pcs.update();
    },
    error: function(jqhxr,b,c) {
      hide_loading_screen();
      Pcs.update();
      alert(jqhxr.responseText);
    }
  });
}

function get_tree_view_resource_id(element) {
  var suffix = '-treeview-element';
  var element_id = $(element).parents('table.tree-element')[0].id;
  if (element_id && element_id.endsWith(suffix)) {
    return element_id.substr(0, element_id.lastIndexOf(suffix));
  }
  return null;
}

function get_list_view_element_id(element) {
  return $(element)[0].id;
}

function auto_show_hide_constraints() {
  var cont = [
    "location_constraints",
    "ordering_constraints",
    "ordering_set_constraints",
    "colocation_constraints",
    "colocation_set_constraints",
    "ticket_constraints",
    "ticket_set_constraints",
    "meta_attributes",
  ];
  $.each(cont, function(index, name) {
    var elem = $("#" + name)[0];
    var cur_resource = Pcs.resourcesContainer.get('cur_resource');
    if (elem && cur_resource) {
      var visible = $(elem).children("span")[0].style.display != 'none';
      if (visible && (!cur_resource.get(name) || cur_resource.get(name).length == 0))
        show_hide_constraints(elem);
      else if (!visible && cur_resource.get(name) && cur_resource.get(name).length > 0)
        show_hide_constraints(elem);
    }
  });
}

function get_resource_agent_metadata(agent, on_success, stonith) {
  stonith = typeof stonith !== 'undefined' ? stonith : false;
  var request = (stonith)
    ? 'get_fence_agent_metadata'
    : 'get_resource_agent_metadata';
  ajax_wrapper({
    url: get_cluster_remote_url() + request,
    dataType: "json",
    data: {agent: agent},
    timeout: pcs_timeout,
    success: on_success,
    error: function (xhr, status, error) {
      alert(
        "Unable to get metadata for resource agent '" + agent + "' "
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function update_instance_attributes(resource_id) {
  var res_obj = Pcs.resourcesContainer.get_resource_by_id(resource_id);
  if (!(res_obj && res_obj.get("is_primitive"))) {
    return;
  }
  get_resource_agent_metadata(res_obj.get("resource_type"), function(data) {
    var agent = Pcs.ResourceAgent.create(data);
    res_obj.set("resource_agent", agent);
    $.each(res_obj.get("instance_attr"), function(_, attr) {
      agent.get_parameter(attr.name).set("value", attr.value);
    });
  }, res_obj.get("stonith"));
}

function tree_view_onclick(resource_id) {
  var resource_obj = Pcs.resourcesContainer.get_resource_by_id(resource_id);
  if (!resource_obj) {
    console.log("Resource " + resource_id + "not found.");
    return;
  }
  if (resource_obj.get('stonith')) {
    if (window.location.hash.startsWith("#/fencedevices")) {
      window.location.hash = "/fencedevices/" + resource_id;
    }
    Pcs.resourcesContainer.set('cur_fence', resource_obj);
  } else {
    if (window.location.hash.startsWith("#/resources")) {
      window.location.hash = "/resources/" + resource_id;
    }
    Pcs.resourcesContainer.set('cur_resource', resource_obj);
    auto_show_hide_constraints();
  }
  update_instance_attributes(resource_id);
  tree_view_select(resource_id);
}

function tree_view_select(element_id) {
  var e = $(`#${element_id}-treeview-element`);
  var view = e.parents('table.tree-view');
  view.find('div.arrow').hide();
  view.find('tr.children').hide();
  view.find('table.tree-element').show();
  view.find('tr.tree-element-name').removeClass("node_selected");
  e.find('tr.tree-element-name:first').addClass("node_selected");
  e.find('tr.tree-element-name div.arrow:first').show();
  e.parents('tr.children').show();
  e.find('tr.children').show();
}

function tree_view_checkbox_onchange(element) {
  var e = $(element);
  var children = $(element).closest(".tree-element").find(".children" +
    " input:checkbox");
  var val = e.prop('checked');
  children.prop('checked', val);
  children.prop('disabled', val);
}

function resource_master(resource_id) {
  if (resource_id == null) {
    return;
  }
  show_loading_screen();
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'resource_master',
    data: {resource_id: resource_id},
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to create master/slave resource "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function resource_promotable(resource_id) {
  if (resource_id == null) {
    return;
  }
  show_loading_screen();
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'resource_promotable',
    data: {resource_id: resource_id},
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to create promotable resource "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function resource_clone(resource_id) {
  if (resource_id == null) {
    return;
  }
  show_loading_screen();
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'resource_clone',
    data: {resource_id: resource_id},
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to clone the resource "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function resource_unclone(resource_id) {
  if (resource_id == null) {
    return;
  }
  show_loading_screen();
  var resource_obj = Pcs.resourcesContainer.get_resource_by_id(resource_id);
  if (!resource_obj) {
    console.log("Resource '" + resource_id + "' not found.");
    return;
  }
  if (resource_obj.get('class_type') == 'clone') {
    resource_id = resource_obj.get('member').get('id');
  }
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'resource_unclone',
    data: {resource_id: resource_id},
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to unclone the resource "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function resource_ungroup(group_id) {
  if (group_id == null) {
    return;
  }
  show_loading_screen();
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'resource_ungroup',
    data: {group_id: group_id},
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to ungroup the resource "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function resource_change_group(resource_id, form) {
  if (resource_id == null) {
    return;
  }
  show_loading_screen();
  var resource_obj = Pcs.resourcesContainer.get_resource_by_id(resource_id);
  if (!resource_obj) {
    console.log("Resource '" + resource_id + "' not found.");
    return;
  }
  var data = {
    resource_id: resource_id
  };
  $.each($(form).serializeArray(), function(_, item) {
    data[item.name] = item.value;
  });

  if (
    resource_obj.get('parent') &&
    resource_obj.get('parent').get('class_type') == 'group'
  ) {
    data['old_group_id'] = resource_obj.get('parent').get('id');
  }

  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + 'resource_change_group',
    data: data,
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to change group "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function ajax_simple_error(xhr, status, error) {
  var message = "(" + $.trim(error) + ")";
  if (
    $.trim(xhr.responseText).length > 0
    &&
    xhr.responseText.indexOf('cib_replace failed') == -1
  ) {
    message = message + "\n\n" + $.trim(xhr.responseText);
  }
  return message;
}

function ajax_wrapper(options) {
  // get original callback functions
  var error_original = function(xhr, status, error) {};
  if (options.error) {
    error_original = options.error;
  }
  var complete_original = function(xhr, status) {};
  if (options.complete) {
    complete_original = options.complete;
  }

  // prepare new callback functions
  var options_new = $.extend(true, {}, options);
  // display login dialog on error
  options_new.error = function(xhr, status, error) {
    if (xhr.status == 401) {
      ajax_queue.push(options);
      if (!login_dialog_opened) {
        login_dialog(function() {
          var item;
          while (ajax_queue.length > 0) {
            item = ajax_queue.shift();
            ajax_wrapper(item);
          }
        });
      }
    }
    else {
      error_original(xhr, status, error);
    }
  };
  // Do not run complete function if login dialog is open.
  // Once user is logged in again, the original complete function will be run
  // in repeated ajax call run by login dialog on success.
  options_new.complete = function(xhr, status) {
    if (xhr.status == 401) {
      return;
    }
    else {
      complete_original(xhr, status);
    }
  };

  // run ajax request or put it into a queue
  if (login_dialog_opened) {
    ajax_queue.push(options);
  }
  else {
    $.ajax(options_new);
  }
}

function login_dialog(on_success) {
  var ok_button_id = "login_form_ok";
  var ok_button_selector = "#" + ok_button_id;
  var buttons = [
    {
      text: translate("Log In"),
      id: ok_button_id,
      click: function() {
        var me = $(this);
        var my_dialog = $(this).dialog();
        my_dialog.find("#login_form_denied").hide();
        $(ok_button_selector).button("option", "disabled", true);
        $.ajax({
          type: "POST",
          url: "/login",
          data: my_dialog.find("#login_form").serialize(),
          complete: function() {
            $(ok_button_selector).button("option", "disabled", false);
          },
          success: function() {
            my_dialog.find("#login_form_username").val("");
            my_dialog.find("#login_form_password").val("");
            me.dialog("destroy");
            login_dialog_opened = false;
            on_success();
          },
          error: function(xhr, status, error) {
            if (xhr.status == 401) {
              my_dialog.find("#login_form_denied").show();
              my_dialog.find("#login_form_password").val("");
            }
            else {
              alert("Login error " + ajax_simple_error(xhr, status, error));
            }
          },
        });
      },
    },
    {
      text: translate("Cancel"),
      id: "login_form_cancel",
      // cancel will close the dialog the same way as X button does
      click: function() {
        $(this).dialog("close");
      },
    },
  ];
  var dialog_obj = $("#dialog_login").dialog({
    title: translate("Log In"),
    modal: true,
    resizable: true,
    width: 400,
    buttons: buttons,
    open: function(event, ui) {
      login_dialog_opened = true;
    },
    create: function(event, ui) {
      login_dialog_opened = true;
    },
    // make sure to logout the user on dialog close
    close: function(event, ui) {
      login_dialog_opened = false;
      location = "/logout";
    },
  });
  dialog_obj.find("#login_form_denied").hide();
  // submit on enter
  dialog_obj.keypress(function(e) {
    if (
      e.keyCode == $.ui.keyCode.ENTER
      &&
      !dialog_obj.parent().find(ok_button_selector).button("option", "disabled")
    ) {
      dialog_obj.parent().find(ok_button_selector).trigger("click");
      return false;
    }
  });
}

var permissions_current_cluster;

function permissions_load_all() {
  show_loading_screen();

  var cluster_list = [];
  $("#node_info div[id^='permissions_cluster_']").each(function(i, div) {
    cluster_list.push(
      $(div).attr("id").substring("permissions_cluster_".length)
    );
  });

  var call_count = cluster_list.length;
  var callback = function() {
    call_count = call_count - 1;
    if (call_count < 1) {
      hide_loading_screen();
    }
  };

  $.each(cluster_list, function(index, cluster) {
    permissions_load_cluster(cluster, callback);
  });

  if (cluster_list.length > 0) {
    permissions_current_cluster = cluster_list[0];
    permissions_show_cluster(
      permissions_current_cluster,
      $("#cluster_list tr").first().next() /* the first row is a heading */
    );
  }
  else {
    hide_loading_screen();
  }
}

function permissions_load_cluster(cluster_name, callback) {
  var element_id = "permissions_cluster_" + cluster_name;
  ajax_wrapper({
    type: "GET",
    url: "/permissions_cluster_form/" + cluster_name,
    timeout: pcs_timeout,
    success: function(data) {
      $("#" + element_id).html(data);
      $("#" + element_id + " :checkbox").each(function(key, checkbox) {
        permissions_fix_dependent_checkboxes(checkbox);
      });
      permissions_cluster_dirty_flag(cluster_name, false);
      if (callback) {
        callback();
      }
    },
    error: function(xhr, status, error) {
      $("#" + element_id).html(
        "Error loading permissions " + ajax_simple_error(xhr, status, error)
      );
      if (callback) {
        callback();
      }
    }
  });
}

function permissions_show_cluster(cluster_name, list_row) {
  permissions_current_cluster = cluster_name;

  var container = $("#node_info");
  container.fadeTo(500, .01, function() {
    container.children().hide();
    $("#permissions_cluster_" + cluster_name).show();
    container.fadeTo(500, 1);
  });

  $(list_row).siblings("tr").each(function(index, row) {
    hover_out(row);
    $(row).find("td").last().children().hide();
  });
  hover_over(list_row);
  $(list_row).find("td").last().children().show();
}

function permissions_save_cluster(form) {
  var dataString = $(form).serialize();
  var cluster_name = permissions_get_clustername(form);
  ajax_wrapper({
    type: "POST",
    url: get_cluster_remote_url(cluster_name) + "permissions_save",
    timeout: pcs_timeout,
    data: dataString,
    success: function() {
      show_loading_screen();
      permissions_load_cluster(cluster_name, hide_loading_screen);
    },
    error: function(xhr, status, error) {
      alert(
        "Unable to save permissions of cluster " + cluster_name + " "
        + ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function permissions_cluster_dirty_flag(cluster_name, flag) {
  var cluster_row = permissions_get_cluster_row(cluster_name);
  if (cluster_row) {
    var dirty_elem = cluster_row.find("span[class=unsaved_changes]");
    if (dirty_elem) {
      if (flag) {
        dirty_elem.show();
      }
      else {
        dirty_elem.hide();
      }
    }
  }
}

function permission_remove_row(button) {
  var cluster_name = permissions_get_clustername(
    $(button).parents("form").first()
  );
  $(button).parent().parent().remove();
  permissions_cluster_dirty_flag(cluster_name, true);
}

function permissions_add_row(template_row) {
  var user_name = permissions_get_row_name(template_row);
  var user_type = permissions_get_row_type(template_row);
  var max_key = -1;
  var exists = false;
  var cluster_name = permissions_get_clustername(
    $(template_row).parents("form").first()
  );

  if("" == user_name) {
    alert(translate("Please enter the name"));
    return;
  }
  if("" == user_type) {
    alert(transelate("Please enter the type"));
    return;
  }

  $(template_row).siblings().each(function(index, row) {
    if(
      (permissions_get_row_name(row) == user_name)
      &&
      (permissions_get_row_type(row) == user_type)
    ) {
      exists = true;
    }
    $(row).find("input").each(function(index, input) {
      var match = input.name.match(/^[^[]*\[(\d+)\].*$/);
      if (match) {
        var key = parseInt(match[1]);
        if(key > max_key) {
          max_key = key;
        }
      }
    });
  });
  if(exists) {
    alert("Permissions already set for the user");
    return;
  }

  max_key = max_key + 1;
  var new_row = $(template_row).clone();
  new_row.find("[name*='_new']").each(function(index, element) {
    element.name = element.name.replace("_new", "[" + max_key + "]");
  });
  new_row.find("td").last().html(
    '<a class="remove" href="#" onclick="permission_remove_row(this);">X</a>'
  );
  new_row.find("[name$='[name]']").each(function(index, element) {
    $(element).after(user_name);
    $(element).attr("type", "hidden");
  });
  new_row.find("[name$='[type]']").each(function(index, element) {
    $(element).after(user_type);
    $(element).after(
      '<input type="hidden" name="' + element.name  + '" value="' + user_type + '">'
    );
    $(element).remove();
  });

  $(template_row).before(new_row);
  var template_inputs = $(template_row).find(":input");
  template_inputs.removeAttr("checked").removeAttr("selected");
  template_inputs.removeAttr("disabled").removeAttr("readonly");
  $(template_row).find(":input[type=text]").val("");

  permissions_cluster_dirty_flag(cluster_name, true);
}

function permissions_get_dependent_checkboxes(checkbox) {
  var cluster_name = permissions_get_clustername(
    $(checkbox).parents("form").first()
  );
  var checkbox_permission = permissions_get_checkbox_permission(checkbox);
  var deps = {};
  var dependent_permissions = [];
  var dependent_checkboxes = [];

  if (permissions_dependencies[cluster_name]) {
    deps = permissions_dependencies[cluster_name];
    if (deps["also_allows"] && deps["also_allows"][checkbox_permission]) {
      dependent_permissions = deps["also_allows"][checkbox_permission];
      $(checkbox).parents("tr").first().find(":checkbox").not(checkbox).each(
        function(key, check) {
          var perm = permissions_get_checkbox_permission(check);
          if (dependent_permissions.indexOf(perm) != -1) {
            dependent_checkboxes.push(check);
          }
        }
      );
    }
  }
  return dependent_checkboxes;
}

function permissions_fix_dependent_checkboxes(checkbox) {
  var dep_checks = $(permissions_get_dependent_checkboxes(checkbox));
  if ($(checkbox).prop("checked")) {
    /* the checkbox is now checked */
    dep_checks.each(function(key, check) {
      var jq_check = $(check);
      jq_check.prop("checked", true);
      jq_check.prop("readonly", true);
      // readonly on checkbox makes it look like readonly but doesn't prevent
      // changing its state (checked - not checked), setting disabled works
      jq_check.prop("disabled", true);
      permissions_fix_dependent_checkboxes(check);
    });
  }
  else {
    /* the checkbox is now empty */
    dep_checks.each(function(key, check) {
      var jq_check = $(check);
      jq_check.prop("checked", jq_check.prop("defaultChecked"));
      jq_check.prop("readonly", false);
      jq_check.prop("disabled", false);
      permissions_fix_dependent_checkboxes(check);
    });
  }
}

function permissions_get_row_name(row) {
  return $.trim($(row).find("[name$='[name]']").val());
}

function permissions_get_row_type(row) {
  return $.trim($(row).find("[name$='[type]']").val());
}

function permissions_get_clustername(form) {
  return $.trim($(form).find("[name=cluster_name]").val());
}

function permissions_get_checkbox_permission(checkbox) {
  var match = checkbox.name.match(/^.*\[([^[]+)\]$/);
  if (match) {
    return match[1];
  }
  return "";
}

function permissions_get_cluster_row(cluster_name) {
  var cluster_row = null;
  $('#cluster_list td[class=node_name]').each(function(index, elem) {
    var jq_elem = $(elem);
    if (jq_elem.text().trim() == cluster_name.trim()) {
      cluster_row = jq_elem.parents("tr").first();
    }
  });
  return cluster_row;
}

function is_cib_true(value) {
  if (value) {
    return (['true', 'on', 'yes', 'y', '1'].indexOf(value.toString().toLowerCase()) != -1);
  }
  return false;
}

function set_utilization(type, entity_id, name, value) {
  var data = {
    name: name,
    value: value
  };
  if (type == "node") {
    data["node"] = entity_id;
  } else if (type == "resource") {
    data["resource_id"] = entity_id;
  } else return false;
  var url = get_cluster_remote_url() + "set_" + type + "_utilization";

  ajax_wrapper({
    type: 'POST',
    url: url,
    data: data,
    timeout: pcs_timeout,
    error: function (xhr, status, error) {
      alert(
        "Unable to set utilization: "
        + ajax_simple_error(xhr, status, error)
      );
    },
    complete: function() {
      Pcs.update();
    }
  });
}

function is_integer(str) {
  if (Number(str) === str && str % 1 === 0) // if argument isn't string but number
    return true;
  var n = ~~Number(str);
  return String(n) === str;
}

Ember.Handlebars.helper('selector-helper', function (content, value, place_holder, options) {
  var out = "";
  var line;
  if (place_holder) {
    out += '<option value="">' + place_holder + '</option>';
  }
  $.each(content, function(_, opt){
    line = '<option value="' + opt["value"] + '"';
    if (value == opt["value"]) {
      line += ' selected="selected"';
    }
    line += ">" + Handlebars.Utils.escapeExpression(opt["name"]) + "</option>";
    out += line + "\n";
  });
  return new Handlebars.SafeString(out);
});

Ember.Handlebars.helper('bool-to-icon', function(value, options) {
  var out = '<span class="sprites inverted ';
  if (typeof(value) == 'undefined' || value == null) {
    out += "questionmarkdark";
  } else if (value) {
    out += "checkdark";
  } else {
    out += "Xdark";
  }
  return new Handlebars.SafeString(out + '">&nbsp;</span>');
});

function nl2br(text) {
  return text.replace(/(?:\r\n|\r|\n)/g, '<br />');
}

function enable_sbd(dialog) {
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + "remote_enable_sbd",
    data: dialog.find("#enable_sbd_form").serialize(),
    timeout: pcs_timeout,
    success: function() {
      dialog.parent().find("#enable_sbd_btn").button(
        "option", "disabled", false
      );
      dialog.dialog("close");
      alert(
        'SBD enabled! You have to restart cluster in order to apply changes.'
      );
      Pcs.update();
    },
    error: function (xhr, status, error) {
      dialog.parent().find("#enable_sbd_btn").button(
        "option", "disabled", false
      );
      xhr.responseText = xhr.responseText.replace(
        "--skip-offline", "option 'ignore offline nodes'"
      );
      alert(
        ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function enable_sbd_dialog(node_list) {
  var buttonsOpts = [
    {
      text: translate("Enable SBD"),
      id: "enable_sbd_btn",
      click: function() {
        var dialog = $(this);
        dialog.parent().find("#enable_sbd_btn").button(
          "option", "disabled", true
        );
        enable_sbd(dialog);
      }
    },
    {
      text:translate("Cancel"),
      click: function () {
        $(this).dialog("close");
      }
    }
  ];

  var dialog_obj = $("#enable_sbd_dialog").dialog({title: translate('Enable SBD'),
    modal: true, resizable: false,
    width: 'auto',
    buttons: buttonsOpts
  });

  dialog_obj.keypress(function(e) {
    if (
      e.keyCode == $.ui.keyCode.ENTER &&
      !dialog_obj.parent().find("#enable_sbd_btn").button("option", "disabled")
    ) {
      dialog_obj.parent().find("#enable_sbd_btn").trigger("click");
      return false;
    }
  });
  dialog_obj.find('#watchdog_table').empty();
  $.each(node_list, function(_, node) {
    dialog_obj.find("#watchdog_table").append(
      '<tr>' +
        '<td>' +
          node + ':' +
        '</td>' +
        '<td>' +
          '<input ' +
            'type="text" ' +
            'placeholder="/dev/watchdog" ' +
            'name="watchdog[' + node + ']" ' +
          '/>' +
        '</td>' +
      '</tr>'
    );
  });
}

function disable_sbd(dialog) {
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + "remote_disable_sbd",
    data: dialog.find("#disable_sbd_form").serialize(),
    timeout: pcs_timeout,
    success: function() {
      dialog.parent().find("#disable_sbd_btn").button(
        "option", "disabled", false
      );
      dialog.dialog("close");
      alert(
        'SBD disabled! You have to restart cluster in order to apply changes.'
      );
      Pcs.update();
    },
    error: function (xhr, status, error) {
      dialog.parent().find("#disable_sbd_btn").button(
        "option", "disabled", false
      );
      xhr.responseText = xhr.responseText.replace(
        "--skip-offline", "option 'ignore offline nodes'"
      );
      alert(ajax_simple_error(xhr, status, error));
    }
  });
}

function disable_sbd_dialog() {
  var buttonsOpts = [
    {
      text: translate("Disable SBD"),
      id: "disable_sbd_btn",
      click: function() {
        var dialog = $(this);
        dialog.parent().find("#disable_sbd_btn").button(
          "option", "disabled", true
        );
        disable_sbd(dialog);
      }
    },
    {
      text:translate("Cancel"),
      click: function () {
        $(this).dialog("close");
      }
    }
  ];

  $("#disable_sbd_dialog").dialog({
    title: translate('Disable SBD'),
    modal: true, resizable: false,
    width: 'auto',
    buttons: buttonsOpts
  });
}

function add_fence_device_dialog() {
  $('#new_stonith_agent').dialog({
      title: translate('Add Fence Device'),
      modal:true,
      width: 'auto'});
}

function add_ACL_Role_dialog() {
  var buttonsOpts = [
    {
      text: translate("Add_Role"),
      click: function() {
        $(this).hide();
        add_acl_role($('#add_acl_role'));
        $(this).show();
      }
    }, 
    {
      text: translate("Cancel"),
      click: function() {
        $(this).dialog('close');
      }
    }
  ];
  $('#add_acl_role').dialog({
          title: translate("Add_ACL_Role"),
          modal: true,
          width: 'auto',
          buttons: buttonsOpts
  });
}

function sbd_status_dialog() {
  var buttonsOpts = [
    {
      text: translate("Enable SBD"),
      click: function() {
        enable_sbd_dialog(Pcs.nodesController.get_node_name_list());
      }
    },
    {
      text: translate("Disable SBD"),
      click: disable_sbd_dialog
    },
    {
      text:translate("Close"),
      click: function () {
        $(this).dialog("close");
      }
    }
  ];

  $("#sbd_status_dialog").dialog({
    title: 'SBD',
    modal: true, resizable: false,
    width: 'auto',
    buttons: buttonsOpts
  });
}

function unmanage_resource(resource_id) {
  if (!resource_id) {
    return;
  }
  fade_in_out("#resource_unmanage_link");
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + "unmanage_resource",
    data: {
      resource_list_json: JSON.stringify([resource_id]),
    },
    timeout: pcs_timeout,
    complete: function() {
      Pcs.update();
    },
    error: function (xhr, status, error) {
      alert(
        `Unable to unmanage '${resource_id}': ` +
        ajax_simple_error(xhr, status, error)
      );
    },
  });
}

function manage_resource(resource_id) {
  if (!resource_id) {
    return;
  }
  fade_in_out("#resource_manage_link");
  ajax_wrapper({
    type: 'POST',
    url: get_cluster_remote_url() + "manage_resource",
    data: {
      resource_list_json: JSON.stringify([resource_id]),
    },
    timeout: pcs_timeout,
    complete: function() {
      Pcs.update();
    },
    error: function (xhr, status, error) {
      alert(
        `Unable to manage '${resource_id}': ` +
        ajax_simple_error(xhr, status, error)
      );
    }
  });
}

function show_add_resource_dialog() {
  var new_resource_group_selector_id = $(
    "#new_resource_agent .group-selector"
  ).attr("id");
  Ember.View.views[new_resource_group_selector_id].set(
    "group_select_value", null
  );
  $('#new_resource_agent').dialog({
    title: translate('Add Resource'),
    modal:true, width: 'auto'
  });
}
