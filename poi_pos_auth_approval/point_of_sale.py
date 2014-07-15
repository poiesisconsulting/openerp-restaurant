# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#    Copyright (C) 2011-2013 Serpent Consulting Services Pvt. Ltd. (<http://serpentcs.com>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

from openerp.osv import fields, osv
import time
from openerp import netsvc, tools
from openerp.tools.translate import _
import openerp.addons.decimal_precision as dp

class pos_order(osv.osv):
    _inherit = 'pos.order'

    _columns = {
        'auth_state': fields.selection([('none', 'Not Applicable'), ('submit', 'Submit'), ('approved', 'Approved'), ('rejected', 'Rejected')], string='Authorization State'),
        'auth_note': fields.text('Submit Note'),
        'resp_note': fields.text('Response Note'),
        'auth_by': fields.many2one('res.users', 'Authorizing User'),
    }
    _defaults = {
        'auth_state': 'none',
    }

    def get_formview_action(self, cr, uid, id, context=None):
        """ Return an action to open the document. This method is meant to be
            overridden in addons that want to give specific view ids for example.

            :param int id: id of the document to open
        """
        view_id = False
        return {
                'type': 'ir.actions.act_window',
                'res_model': self._name,
                'view_type': 'form',
                'view_mode': 'form',
                'views': [(view_id, 'form')],
                'target': 'current',
                'res_id': id,
            }

    def send_approval_message(self, cr, uid, order_id, user_dest_ids, messages, request_text, context=None):
        if not context:
            context = {}

        users_pool = self.pool.get('res.users')
        mail_thread_pool=self.pool.get('mail.thread')

        partners_dest = []
        for user in users_pool.browse(cr, uid, user_dest_ids):
            partners_dest.append(user.partner_id.id)

        body = '<ul>'
        for message in messages:
            body+='<li>'+message+'</li>'
        body += '</ul><br/>'+request_text

        post_values = {
                        'subject': _('Authorization Request'),
                        'body': body,
                        'partner_ids': partners_dest,
                        'notified_partner_ids': partners_dest,
                        'attachments': [ ],
        }
        subtype = 'mail.mt_comment'

        ref = self.pool.get('ir.model.data').get_object_reference(cr, uid, 'mail', 'mt_comment')
        subtype_id = ref and ref[1] or False

        message_id=mail_thread_pool.message_custom_post(cr, uid, [0], type='notification', subtype=subtype, model='pos.order', res_id=order_id, context=context, **post_values)

        self.write(cr, uid, [order_id], {'auth_state': 'submit', 'auth_note': body})


        message = "<br/><br/>Note: Please check your Messaging Tab to check this request"

        web_alert_pool = self.pool.get('web.alert')
        web_alert_pool.send_alert(cr, uid, user_dest_ids, body+message, relevance='alert')

        return message_id

    def approve(self, cr, uid, ids, context=None):
        self.write(cr, uid, ids, {'auth_state': 'approved', 'auth_by': uid})

    def reject(self, cr, uid, ids, context=None):
        self.write(cr, uid, ids, {'auth_state': 'rejected', 'auth_by': uid})

class pos_auth_condition(osv.osv):
    _name = 'pos.auth.condition'

    _columns = {
        'name': fields.char('Name', size=64),
        'pos_config_ids': fields.many2many('pos.config','pos_auth_condition_config_rel','condition_id','config_id','Point of Sales affected'),
        'users_notified': fields.many2many('res.users','pos_auth_res_users_rel','condition_id','user_id','Users Notified'),
        'condition_lines': fields.one2many('pos.auth.condition.lines','condition_id','Conditions'),
        'active': fields.boolean('Active'),
    }

class pos_auth_condition_lines(osv.osv):
    _name = 'pos.auth.condition.lines'
    _columns = {
        'condition_id': fields.many2one('pos.auth.condition','Condition'),
        'field_name': fields.many2one('ir.model.fields','Field', domain="[('model_id', '=', 'pos.order'),('ttype','in',['boolean','char','text','float','integer','many2one'])]"),
        'operator': fields.selection([('major','>'),('minor','<'),('equal','='),('inequal','!='),('like','like'),('is_not_set','Is not set'),('is_set','Is set')],'Operator'),
        'condition_value': fields.char('Value'),
        'message': fields.text('Message'),
    }