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

from openerp.osv import osv,fields
from openerp.tools.translate import _

class table_merge_wizard(osv.osv_memory):

    _name = 'table.merge.wizard'

    _columns = {
        'base_order_id': fields.many2one('pos.order','Base Order',required=True, domain=[('state','=','draft')]),
        'case': fields.selection([('from','Merge From'),('into','Merge Into')], string="Merge Direction"),
        'target_order_ids': fields.one2many('table.merge.wizard.line', 'wizard_id', 'Target Orders'),
        'from_order_ids': fields.one2many('table.merge.wizard.line', 'wizard_id', 'Merge from Orders'),
        'into_order_id': fields.many2one('pos.order','Merge Into Order', domain=[('state','=','draft')]),
        'backend': fields.boolean('Backend Call'),

    }
    _defaults = {
        'case': 'into',
        'backend': False,
    }

    def default_get(self, cr, uid, fields, context=None):

        if context is None:
            context = {}

        res = super(table_merge_wizard, self).default_get(cr, uid, fields, context=context)

        base_order_id = context.get('base_order_id',0)
        if base_order_id > 0:
            res['base_order_id'] = base_order_id
        if context.get('backend'):
            res['backend'] = True

        res['target_order_ids'] = []
        order_pool = self.pool.get('pos.order')
        draft_ids = order_pool.search(cr, uid, [('state','=','draft'), ('id','!=',base_order_id)], order="tables", context=context)
        for o_id in draft_ids:
            res['target_order_ids'].append({'order_id': o_id, 'apply': False})

        return res

    def merge_orders(self, cr, uid, ids, context=None):

        order_pool = self.pool.get('pos.order')
        order_line_pool = self.pool.get('pos.order.line')

        for wizard in self.browse(cr, uid, ids):

            if wizard.case == 'into':
                base_order = order_pool.browse(cr, uid, [wizard.base_order_id.id], context=context)
                if base_order:
                    base_order = base_order[0]
                    if base_order.state != 'draft':
                        raise osv.except_osv(_('User Error'), _('This action is Invalid on a base Order that is not on a Draft state.'))
                else:
                    raise osv.except_osv(_('Data Error'), _('The base Order given no longer exists.'))


                target_order_id = False
                for target in wizard.target_order_ids:
                    if target.apply:
                        target_order_id = target.order_id and target.order_id.id or False
                        break

                if not target_order_id:
                    raise osv.except_osv(_('User Error'), _('You have to select one Target Order.'))

                transfer_lines = []
                for line in base_order.lines:
                    transfer_lines.append(line.id)

                #Point base lines to the Target order
                written = order_line_pool.write(cr, uid, transfer_lines, {'order_id': target_order_id})
                if written:
                    target_read = order_pool.read(cr, uid, [target_order_id], ['print_resume','fired_courses'])
                    #Copy printing summary of lines which are dictionaries
                    new_print = ""
                    base_print = base_order.print_resume
                    if base_print and len(base_print) > 0:

                        target_print = target_read and target_read[0] and target_read[0]['print_resume'] or False

                        if target_print and len(target_print) > 0:
                            target_dict = eval(target_print.replace('true','True').replace('false','False').replace('null','False'))
                            base_dict = eval(base_print.replace('true','True').replace('false','False').replace('null','False'))
                            if isinstance (target_dict,dict) and isinstance(base_dict,dict):
                                target_dict.update(base_dict)
                                new_print = str(target_dict).replace('True','true').replace('False','false').replace('null','False')
                        else:
                            new_print = base_print

                    #Concatenation of Courses times
                    new_course = ""
                    target_course = target_read and target_read[0] and target_read[0]['fired_courses'] or ""
                    base_course = base_order.fired_courses or ""
                    new_course = target_course + base_course

                    #Write both printing and courses information into target order
                    order_pool.write(cr, uid, [target_order_id], {'resume_print': new_print, 'fired_courses': new_course})

                    #Free tables
                    tables_to_free = order_pool.read(cr, uid, base_order.id, ['table_ids'])['table_ids']
                    self.pool.get('table.table').write(cr, uid, tables_to_free, {'state': 'open'})

                    #Delete base order
                    order_pool.unlink(cr, uid, [base_order.id])

            elif wizard.case == 'from':
                pass
                #ToDo: Implement From
                raise osv.except_osv(_('Version Error'), _('FROM not implemented yet. Update next version'))
            else:
                raise osv.except_osv(_('Data Error'), _('Unknown Merge case.'))

        if wizard.backend:
            return {
                'view_mode': 'tree',
                'view_type': 'form',
                'res_model': 'pos.order',
                'type': 'ir.actions.act_window',
                'nodestroy': True,
                'context': context,
            }
        else:
            return True

class table_merge_wizard_line(osv.osv_memory):

    _name = 'table.merge.wizard.line'

    _columns = {
        'wizard_id': fields.many2one('table.merge.wizard','Merge Wizard',ondelete='cascade'),
        'order_id': fields.many2one('pos.order','Order', domain=[('state','=','draft')]),
        'apply': fields.boolean('Apply'),
    }

    def toggle_apply(self, cr, uid, ids, context=None):
        if context is None:
            context={}

        for row in self.browse(cr, uid, ids, context=context):
            if row.apply:
                self.write(cr, uid, [row.id], {'apply': False}, context=context)
            else:
                self.write(cr, uid, [row.id], {'apply': True}, context=context)