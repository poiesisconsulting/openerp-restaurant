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

class waiting_queue_allow_state(osv.osv_memory):
    
    _name = "waiting.queue.allow.state"
    
    def allow_process(self, cr, uid, ids, context=None):
        if context is None: context = {}
        waiting_queue_obj = self.pool.get('waiting.queue')
        for data in self.browse(cr, uid, ids):
            tables_list=[]
            for table in data.table_table_ids:
                tables_list.append((4,table.id))
            waiting_queue_obj.write(cr, uid, context.get('active_ids'), {'table_ids':tables_list, 'state':'allow'}, context=context)
        return True
    
    _columns = {
            'table_table_ids': fields.many2many('table.table', 'table_table_queue_rel', 'table_id', 'queue_id', 'Tables'),
    }

waiting_queue_allow_state()
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: